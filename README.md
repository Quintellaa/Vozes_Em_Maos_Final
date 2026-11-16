# Vozes em Mãos

Aplicativo de **tradução de Libras em tempo real**, para aproximar pessoas surdas e ouvintes.

- **Libras → texto e voz:** a câmera acompanha as mãos e o corpo, o app reconhece o sinal,
  escreve a palavra na tela e pode falar em voz alta.
- **Texto → Libras:** a pessoa digita uma frase e o avatar do **VLibras** (ferramenta
  oficial do Governo Federal) faz os sinais.
- **Histórico** das traduções, com favoritos e busca.
- **Perfil** com foto, configurações de acessibilidade (alto contraste, tamanho do texto,
  voz) e notificações.
- **Comunidades** com mural de publicações.
- Funciona no computador e pode ser **instalado no celular** (Android e iPhone) como app.

---

## Opção 1 — Usar pelo celular (sem instalar nada no PC)

O app fica publicado na nuvem (Render). Basta abrir o link no celular:

> **Link do app:** `https://vozes-em-maos.onrender.com` *(troque pelo link do seu serviço no Render, se for outro)*

### Instalar como aplicativo

**Android (Chrome)**
1. Abra o link no **Chrome**.
2. Toque no menu **⋮ → "Instalar app"** (ou "Adicionar à tela inicial").
3. O ícone do Vozes em Mãos aparece na tela inicial.

**iPhone (Safari)**
1. Abra o link no **Safari** (pelo Chrome do iPhone essa opção não aparece).
2. Toque em **Compartilhar** (o quadrado com a seta) → **"Adicionar à Tela de Início"** → **Adicionar**.

> O servidor gratuito "dorme" depois de 15 minutos sem uso. Se o app demorar para abrir,
> espere uns 50 segundos: é ele acordando.

### Publicar o app no Render

Só é preciso fazer isso uma vez, para colocar o app no ar com o seu próprio link.

1. Envie o projeto para um repositório no **GitHub**.
2. Entre em <https://render.com> com **"Sign in with GitHub"**.
3. No painel, clique em **New → Blueprint** e escolha o repositório. O Render lê o
   `render.yaml` e cria o servidor (`vozes-em-maos`) e o banco de dados (`vozes-em-maos-db`).
4. Clique em **Apply** e espere o primeiro deploy (5 a 10 minutos).
5. O link do app aparece no topo do serviço `vozes-em-maos`. Para conferir se está no ar,
   abra `SEU-LINK/health`: deve aparecer `"status":"ok"`.

Depois disso, cada mudança enviada ao GitHub é publicada sozinha em poucos minutos, e o
app instalado no celular pega a versão nova na próxima vez que for aberto.

**Avisos do plano grátis do Render:** o banco de dados gratuito vence 30 dias depois de
criado (é só criar outro), e as contas criadas no PC não existem na nuvem, porque são
bancos diferentes.

---

## Opção 2 — Baixar e rodar no computador

### O que precisa ter instalado

- **Python 3.12 ou mais novo** — <https://www.python.org/downloads/>
  (no Windows, marque **"Add Python to PATH"** na instalação).
- Um navegador atualizado (Chrome ou Edge recomendados) e uma **webcam**.
- Internet (o app baixa o MediaPipe e o VLibras na hora de usar).

### 1. Baixar o projeto

- **Pelo GitHub:** botão verde **Code → Download ZIP**, ou `git clone <link do repositório>`.
- **Pelo arquivo .zip:** extraia o arquivo para uma pasta (ex.: `Documentos/Vozes_em_Maos`).

### 2. Instalar e ligar o servidor

Abra um terminal **dentro da pasta do projeto** e rode:

**Windows**
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload
```

**Linux / Mac**
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

A instalação (`pip install`) leva alguns minutos só na primeira vez. Quando aparecer
`Application startup complete`, o servidor está ligado. **Deixe esse terminal aberto**
enquanto usa o app.

> **Recomendado:** para reconhecer os mesmos sinais da versão na nuvem, abra o arquivo
> `backend/.env` e troque a linha do modelo por:
> ```
> MODEL_PATH=models/libras_grupo_2026-11-02.joblib
> ```
> Depois pare o servidor (Ctrl+C) e ligue de novo com `uvicorn app.main:app --reload`.

### 3. Abrir o app

Acesse **<http://localhost:8000>** no navegador.

Para usar de novo outro dia, basta abrir o terminal na pasta `backend`, ativar o ambiente
(`.venv\Scripts\activate` no Windows ou `source .venv/bin/activate` no Linux/Mac) e rodar
`uvicorn app.main:app --reload`.

---

## Como usar

1. **Crie uma conta** com nome, e-mail e senha (ou entre, se já tiver).
2. **Permita o acesso à câmera** quando o app pedir.
3. No **Tradutor**:
   - **Libras → Texto:** ative a câmera, enquadre as mãos e o tronco e faça o sinal.
     A palavra reconhecida aparece na tela; toque em **🔊 Ouvir frase** para escutar.
   - **Texto → Libras:** digite uma frase e o avatar do VLibras faz os sinais.
4. Veja e favorite suas traduções no **Histórico**.
5. No **Perfil**, troque a foto, ajuste a acessibilidade e entre em **Comunidades**.

**Sinais reconhecidos pela câmera** (modelo da equipe): oi, olá, olá tudo bem?, tudo bem,
bom dia, boa tarde, boa noite, tchau, até mais, sim, não, obrigado, por favor, desculpa,
ajuda, água, banheiro, meu nome é, qual seu nome?

**Dicas para o reconhecimento funcionar melhor:** boa iluminação, fundo liso, mãos e
tronco aparecendo na câmera, e sinal feito em velocidade normal. Faça **um sinal por vez**:
depois de cada um, abaixe as mãos até saírem da câmera. É assim que o app sabe que o
sinal terminou.

---

## Estrutura do projeto

```
frontend/         Site do app (HTML, CSS e JavaScript) — telas, câmera, VLibras
backend/          API em Python (FastAPI) — contas, histórico, comunidades e reconhecimento
  models/         Modelos de reconhecimento de Libras já treinados
  tests/          Testes automatizados
tools/            Ferramentas da equipe: treinar o modelo e configurar o e-mail
dados/gravacoes/  Gravações dos sinais usadas no treino do modelo
Dockerfile        Monta o servidor na nuvem (usado pelo Render)
render.yaml       Configuração da publicação no Render (servidor + banco de dados)
```

## Tecnologias

- **Front-end:** HTML, CSS e JavaScript puro, PWA (instalável no celular)
- **Câmera e pontos das mãos/corpo:** MediaPipe (Google)
- **Texto → Libras:** VLibras
- **Back-end:** Python, FastAPI, SQLAlchemy, SQLite (no PC) e PostgreSQL (na nuvem)
- **Reconhecimento:** modelo de aprendizado de máquina com scikit-learn
- **Hospedagem:** Render (com Docker)

## Mais documentação

- [`backend/README.md`](backend/README.md): detalhes da API, rotas e testes
- [`tools/README.md`](tools/README.md): como gravar sinais e treinar um modelo novo
