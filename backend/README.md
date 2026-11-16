# Vozes em Mãos — API (backend)

Backend em **FastAPI**. Cuida de contas e login, histórico de traduções, perfil com foto,
comunidades, "esqueci a senha" por e-mail e do **reconhecimento de Libras** (recebe os
pontos das mãos e do corpo capturados pela câmera e devolve o sinal reconhecido).

O próprio backend também entrega o site (a pasta `frontend/`), então o app inteiro roda
num endereço só.

- **No PC:** o banco é SQLite, um arquivo `sinaliza.db` criado sozinho, sem instalar nada.
- **Na nuvem (Render):** o banco é PostgreSQL, configurado pelo `render.yaml` da raiz.

## Como rodar no PC

Precisa do **Python 3.12 ou mais novo**.

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate    |    Linux/Mac: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # Windows: copy .env.example .env
uvicorn app.main:app --reload
```

Abra `http://localhost:8000` para usar o app. A documentação interativa da API
(Swagger) fica em `http://localhost:8000/docs`.

Também dá para abrir o front-end pelo Live Server do VS Code (porta 5500/5501, já
liberadas no CORS do `.env.example`). Nesse caso o site chama a API na porta 8000 sozinho.

### Qual modelo de reconhecimento usar

O modelo é escolhido pelo `MODEL_PATH` no `.env`. Os dois que estão em `models/`:

| Arquivo | O que reconhece | Onde é usado |
|---|---|---|
| `libras_grupo_2026-11-02.joblib` | 19 sinais (gravações da equipe + vídeos da base V-LIBRASIL) | Na nuvem (`render.yaml`) |
| `libras_pose_hands.joblib` | 20 sinais da base MINDS-Libras | Padrão do `.env.example` e dos testes |

Para o PC reconhecer os mesmos sinais que o app na nuvem, coloque no `.env`:

```
MODEL_PATH=models/libras_grupo_2026-11-02.joblib
```

Sem modelo nenhum, a API sobe normalmente e só a rota `/recognition` responde 503.
Para treinar um modelo novo, veja [`tools/README.md`](../tools/README.md).

### E-mail do "Esqueci a senha"

Sem nada configurado, o link de redefinição aparece no terminal do backend (bom para
testar). Para enviar e-mail de verdade, preencha uma das opções explicadas no
`.env.example` (Gmail por Google Apps Script ou SMTP).

## Testes

```bash
cd backend
pytest -q
```

Cobrem cadastro e login, perfil e foto, histórico (inclusive que um usuário não enxerga
o histórico de outro), comunidades, envio de e-mail, a extração de características,
a rota `/recognition` e o treino do modelo. Cada execução usa um banco temporário e não
mexe no `sinaliza.db`.

## Estrutura

```
app/
  main.py             # cria o app, CORS, tabelas e comunidades iniciais; entrega o frontend/
  config.py           # variáveis de ambiente (lidas do .env)
  database.py         # conexão com o banco (SQLite ou PostgreSQL)
  models.py           # tabelas: usuários, histórico, comunidades, membros, publicações, códigos de senha
  schemas.py          # formatos de entrada e saída da API (Pydantic)
  security.py         # hash de senha + token JWT
  deps.py             # get_current_user (descobre quem está logado pelo token)
  mailer.py           # envio do e-mail de redefinição de senha
  libras_features.py  # pontos da câmera → vetor de características (o mesmo do treino)
  routers/
    auth.py           # cadastro, login, perfil, foto, troca e redefinição de senha
    history.py        # histórico de traduções
    recognition.py    # reconhecimento de Libras (aplica o modelo)
    communities.py    # comunidades e mural de publicações
    users.py          # foto pública dos usuários
models/               # modelos de reconhecimento (.joblib) — ver models/LEIA-ME.txt
tests/                # testes automatizados (pytest)
```

## Endpoints

Rotas com "sim" em Auth esperam o header `Authorization: Bearer <token>`, onde `<token>`
é o `access_token` devolvido no cadastro ou no login.

**Conta e perfil**

| Método | Rota | Auth | Descrição |
|--------|------|:---:|-----------|
| POST   | `/auth/register`        | não | Cria conta com e-mail e senha |
| POST   | `/auth/login`           | não | Login com e-mail e senha |
| POST   | `/auth/social`          | não | Login Google/Apple — **simulado**, ver pendências |
| GET    | `/auth/me`              | sim | Dados do usuário logado |
| PATCH  | `/auth/me`              | sim | Edita o nome e o nome de usuário |
| POST   | `/auth/password`        | sim | Troca a senha (só contas com e-mail e senha) |
| POST   | `/auth/forgot-password` | não | Envia por e-mail o link de redefinição de senha |
| POST   | `/auth/reset-password`  | não | Troca a senha com o código do link (vale 30 min, uma vez só) e já faz login |
| PUT    | `/auth/me/avatar`       | sim | Envia a foto de perfil |
| DELETE | `/auth/me/avatar`       | sim | Remove a foto de perfil |
| GET    | `/auth/me/stats`        | sim | Quantas traduções o usuário já salvou |
| GET    | `/users/{id}/avatar`    | não | Foto de perfil de um usuário |

**Histórico**

| Método | Rota | Auth | Descrição |
|--------|------|:---:|-----------|
| GET    | `/history?type=&favorite=&search=` | sim | Lista o histórico (com filtros) |
| POST   | `/history`                | sim | Salva uma tradução |
| PATCH  | `/history/{id}/favorite`  | sim | Marca/desmarca como favorito |
| DELETE | `/history/{id}`           | sim | Remove um registro |
| DELETE | `/history`                | sim | Limpa todo o histórico |

**Reconhecimento de Libras**

| Método | Rota | Auth | Descrição |
|--------|------|:---:|-----------|
| POST   | `/recognition/predict` | sim | Quadros com os pontos da câmera → sinal + confiança |
| GET    | `/recognition/info`    | sim | Se há modelo carregado e quais sinais ele conhece |

**Comunidades**

| Método | Rota | Auth | Descrição |
|--------|------|:---:|-----------|
| GET    | `/communities?search=&category=&joined=` | sim | Lista e busca comunidades |
| POST   | `/communities`                      | sim | Cria uma comunidade |
| GET    | `/communities/{id}`                 | sim | Detalhe de uma comunidade |
| POST   | `/communities/{id}/join`            | sim | Entra na comunidade |
| DELETE | `/communities/{id}/join`            | sim | Sai da comunidade |
| GET    | `/communities/{id}/posts`           | sim | Mural de publicações |
| POST   | `/communities/{id}/posts`           | sim | Publica no mural |
| DELETE | `/communities/{id}/posts/{post_id}` | sim | Apaga uma publicação |

**Outros**

| Método | Rota | Auth | Descrição |
|--------|------|:---:|-----------|
| GET    | `/health` | não | Confere se o servidor está no ar e qual banco está em uso |

## Pendências conhecidas

1. **O login com Google/Apple é simulado.** `/auth/social` confia no nome e e-mail
   enviados pelo app, sem verificar com o Google ou a Apple. Para uso real, é preciso
   validar o token de cada serviço (comentário `TODO` em `app/routers/auth.py`).
2. **Migrações do banco:** as tabelas são criadas automaticamente ao subir a API
   (`create_all`), o que não altera colunas de tabelas que já existem. Com o projeto
   crescendo, o ideal é passar a versionar as mudanças com Alembic.
3. **CORS:** em outro domínio, ajuste `CORS_ORIGINS` no `.env`.
