"""Testes do envio de e-mail — sem enviar nada de verdade (a chamada à internet é trocada por uma falsa)."""
import io
import json
import urllib.error

import pytest

from app import mailer
from app.config import settings


class _RespostaFalsa:
    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def read(self):
        return b"{}"


@pytest.fixture
def pedidos(monkeypatch):
    """Guarda cada chamada que o mailer faria à internet."""
    feitos = []

    def urlopen_falso(request, timeout=None):
        feitos.append(request)
        return _RespostaFalsa()

    monkeypatch.setattr(mailer.urllib.request, "urlopen", urlopen_falso)
    for campo in ("gmail_script_url", "gmail_script_secret", "smtp_host"):
        monkeypatch.setattr(settings, campo, "")
    monkeypatch.setattr(settings, "mail_from", "contato@vozes.com")
    return feitos


def _resposta_do_script(monkeypatch, pedidos, corpo: bytes):
    """Faz o urlopen falso devolver `corpo`, como se fosse a resposta do Google Apps Script."""
    class Resposta(_RespostaFalsa):
        def read(self):
            return corpo

    def urlopen_falso(request, timeout=None):
        pedidos.append(request)
        return Resposta()

    monkeypatch.setattr(mailer.urllib.request, "urlopen", urlopen_falso)
    monkeypatch.setattr(settings, "gmail_script_url", "https://script.google.com/macros/s/ABC/exec")
    monkeypatch.setattr(settings, "gmail_script_secret", "meu-segredo")


def test_gmail_script_monta_o_pedido_certo(pedidos, monkeypatch, capsys):
    _resposta_do_script(monkeypatch, pedidos, b'{"ok": true, "restantesHoje": 99}')
    monkeypatch.setattr(settings, "smtp_host", "smtp.exemplo.com")  # mesmo com SMTP configurado, o Gmail vem primeiro

    mailer.send_password_reset("ana@teste.com", "Ana Souza", "https://app/redefinir-senha.html#c=abc", "https://app/img/mascote-email.png")

    assert len(pedidos) == 1
    assert pedidos[0].full_url == "https://script.google.com/macros/s/ABC/exec"
    corpo = json.loads(pedidos[0].data)
    assert corpo["secret"] == "meu-segredo" and corpo["to"] == "ana@teste.com"
    assert "#c=abc" in corpo["text"] and "#c=abc" in corpo["html"]
    assert "[E-MAIL ENVIADO]" in capsys.readouterr().out


def test_gmail_script_recusou_aparece_no_log(pedidos, monkeypatch, capsys):
    _resposta_do_script(monkeypatch, pedidos, b'{"ok": false, "error": "Segredo incorreto"}')
    mailer.send_email("ana@teste.com", "Oi", "texto", "<p>html</p>")
    saida = capsys.readouterr().out
    assert "[FALHA AO ENVIAR E-MAIL]" in saida and "Segredo incorreto" in saida


def test_gmail_script_mal_implantado_explica_o_que_conferir(pedidos, monkeypatch, capsys):
    # Implantação sem "Qualquer pessoa": o Google devolve uma página de login em HTML.
    _resposta_do_script(monkeypatch, pedidos, b"<!DOCTYPE html><html>Fazer login</html>")
    mailer.send_email("ana@teste.com", "Oi", "texto", "<p>html</p>")
    saida = capsys.readouterr().out
    assert "[FALHA AO ENVIAR E-MAIL]" in saida and "/exec" in saida and "Qualquer pessoa" in saida


def test_sem_configuracao_mostra_o_link_no_terminal(pedidos, capsys):
    mailer.send_password_reset("ana@teste.com", "Ana", "https://app/redefinir-senha.html#c=abc", "https://app/img/mascote-email.png")
    assert pedidos == []
    assert "#c=abc" in capsys.readouterr().out


def test_erro_do_servico_aparece_no_log_sem_derrubar_o_app(monkeypatch, capsys):
    def urlopen_com_erro(request, timeout=None):
        corpo = io.BytesIO(b'{"ErrorMessage":"sender not validated"}')
        raise urllib.error.HTTPError(request.full_url, 401, "Unauthorized", {}, corpo)

    monkeypatch.setattr(mailer.urllib.request, "urlopen", urlopen_com_erro)
    monkeypatch.setattr(settings, "gmail_script_url", "https://script.google.com/macros/s/ABC/exec")
    monkeypatch.setattr(settings, "gmail_script_secret", "meu-segredo")

    mailer.send_email("ana@teste.com", "Oi", "texto", "<p>html</p>")  # não pode levantar exceção

    saida = capsys.readouterr().out
    assert "[FALHA AO ENVIAR E-MAIL]" in saida and "HTTP 401" in saida and "sender not validated" in saida


def test_email_tem_o_mascote_e_o_visual_do_app():
    assunto, texto, html = mailer.password_reset_email("Ana Souza", "https://app/redefinir-senha.html#c=abc", "https://app/img/mascote-email.png")
    assert 'src="https://app/img/mascote-email.png"' in html
    assert "#2563eb" in html and "Criar nova senha" in html and "Esqueceu a senha, Ana?" in html
    assert "#c=abc" in texto


def test_email_escapa_o_nome():
    _, _, html = mailer.password_reset_email("<b>Ana</b>", "https://app/x#c=abc", "https://app/m.png")
    assert "<b>Ana</b>" not in html and "&lt;b&gt;Ana&lt;/b&gt;" in html
