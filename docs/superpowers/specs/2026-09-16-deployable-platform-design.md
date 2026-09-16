# Simulador de Autômatos — Plataforma deployável com contas

Data: 2026-09-16

Substitui as seções "Fora de escopo" e "Stack" do spec de 2026-08-19 no que diz
respeito a contas, persistência e deploy. O editor visual, o motor e o modelo de
dados descritos lá continuam valendo.

## Visão geral

O simulador deixa de ser uma aplicação client-only e passa a ser um produto
público: qualquer pessoa cria uma conta, guarda seus autômatos no servidor e
pode compartilhar um autômato por link de leitura. Toda a regra de negócio
(simulação, validação, conversão, auto-layout) roda exclusivamente no servidor;
o bundle do front não contém o motor.

## Decisões fechadas

| Tema | Decisão |
|---|---|
| Público | Produto aberto: cadastro livre, verificação de e-mail, recuperação de senha, rate limiting |
| Backend | Node/TypeScript, reaproveitando o motor atual sem reescrita |
| Fronteira da lógica | Computação (simular, validar, converter, layout) só no servidor. Parsing de texto de rótulo no front, para feedback ao digitar. O servidor re-valida tudo ao salvar |
| Autenticação | E-mail + senha. Username único. O campo de login aceita e-mail ou username |
| Compartilhamento | Biblioteca pessoal privada + link público de leitura, com "duplicar para minha biblioteca" |
| Hospedagem | VPS próprio com Docker Compose. Dev local com hot reload e um comando para subir tudo |
| Salvamento | Autosave do documento inteiro com debounce e versão otimista (409 em conflito) |

## Fora de escopo desta versão

- Login social (OAuth).
- Galeria ou busca pública de autômatos.
- Colaboração em tempo real e edição por operações granulares.
- CI/CD. O deploy é um script rodado no VPS; GitHub Actions fica como passo
  futuro documentado.
- Papéis (professor/aluno), turmas, exercícios.

## Estrutura do repositório

Monorepo com pnpm workspaces. O lockfile do npm é removido; só `pnpm-lock.yaml`
fica.

```
automaton-simulator/
  package.json              raiz: workspaces e scripts agregados
  pnpm-workspace.yaml
  packages/
    shared/                 visível para front e servidor
      src/types.ts            Automaton, Transition, AutomatonKind, EPSILON, BLANK, formatTransitionLabel...
      src/labelSyntax.ts      parse/format de texto de rótulo (parte pura do atual transitionSyntax.ts)
      src/api.ts              schemas Zod e tipos de request/response da API
    engine/                 visível só para o servidor
      src/simulate.ts, simulateTuring.ts, validate.ts,
          convertNfaToDfa.ts, autoLayout.ts, labelEditing.ts
      (testes atuais movidos junto, sem alteração de lógica)
  apps/
    web/                    o app React atual
    api/                    Fastify
  infra/
    compose.yaml            base
    compose.dev.yaml        Postgres + Mailpit; API e web com hot reload
    compose.prod.yaml       Postgres + API + web buildado + Caddy + backup
    Caddyfile
    deploy.sh, restore.sh
  docs/superpowers/specs/
```

### Fronteira do motor

- `src/engine` e `src/types/automaton.ts` são movidos, não reescritos.
- `transitionSyntax.ts` é dividido: o parsing de texto puro
  (`"a,b,D"` → `{input, write, move}`, `"a,Z→AZ"` → `{input, pop, push}`,
  apelidos de ε e de ␣, formatação inversa, placeholders) vai para
  `packages/shared/labelSyntax.ts`. O que consulta alfabeto ou aplica regra
  semântica fica em `packages/engine` (`labelEditing.ts` e o restante).
  A linha de corte exata é confirmada ao escrever o plano, lendo o arquivo.
- `apps/web/package.json` não declara `@automaton/engine` como dependência,
  então um import falha na resolução. Uma regra `no-restricted-imports` no
  oxlint bloqueia o caminho relativo.
- Um teste de build do front confirma que um marcador do motor (por exemplo a
  string `MAX_CLOSURE_EXPANSIONS`) não aparece no bundle.

### O que sai e o que fica no front

- Sai: `src/persistence/storage.ts` (localStorage do workspace), substituído
  pelo cliente da API.
- Fica: export/import JSON e export PNG (funcionalidades de arquivo, não de
  negócio). Tema e snap-to-grid continuam em localStorage (preferências de
  interface).

## Banco de dados

Postgres 16 com Drizzle ORM. Migrações SQL geradas pelo `drizzle-kit` e
commitadas em `apps/api/drizzle/`. A API roda as migrações pendentes ao
iniciar.

### Tabelas de autenticação

Geradas pelo Better Auth, com o plugin de username:

- `user`: `id`, `email` (único, case-insensitive), `email_verified`,
  `username` (único, case-insensitive, 3 a 30 caracteres `[a-z0-9_]`),
  `display_username`, `name`, `created_at`, `updated_at`.
- `session`: `id`, `user_id`, `token`, `expires_at`, `ip_address`,
  `user_agent`. Sessão de 30 dias, renovada a cada uso.
- `account`: credenciais por provedor. Com só e-mail+senha, guarda o hash da
  senha (scrypt, padrão da biblioteca).
- `verification`: tokens de verificação de e-mail e de reset de senha, com
  expiração.

### Tabelas do domínio

```sql
automaton (
  id            uuid primary key,
  owner_id      text not null references "user"(id) on delete cascade,
  name          text not null,
  kind          text not null check (kind in ('DFA','NFA','PDA','TM')),
  document      jsonb not null,      -- o Automaton completo (schemaVersion 1)
  version       integer not null default 1,
  public_slug   text unique,         -- null = privado; 12 chars aleatórios quando publicado
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index automaton_owner_updated on automaton (owner_id, updated_at desc);

workspace (
  user_id       text primary key references "user"(id) on delete cascade,
  open_ids      uuid[] not null default '{}',   -- abas abertas, em ordem
  active_id     uuid
);
```

`document` fica em JSONB porque o autômato é sempre lido e gravado inteiro, o
motor já consome esse formato e não há consulta cruzando estados ou transições
de usuários diferentes. `name` e `kind` são colunas próprias para listar a
biblioteca sem carregar o JSON.

### Versão otimista

`PUT /api/automatons/:id` envia `version`. O servidor executa
`UPDATE ... WHERE id = $1 AND owner_id = $2 AND version = $3`, incrementando a
versão. Zero linhas afetadas vira `409 Conflict` com o documento atual no
corpo, para o front oferecer recarregar.

### Limites

Máximo de 200 autômatos por usuário e 256 KB por documento, verificados na
API antes de tocar no banco ou no motor.

### Infra de banco

- Dev: `postgres:16-alpine` com volume nomeado, porta 5432 exposta só em
  `127.0.0.1`.
- Prod: mesmo container, sem porta exposta, volume em
  `/var/lib/automaton/pgdata`. Container `backup` roda `pg_dump` diário para
  `/var/lib/automaton/backups`, mantendo 14 dias. `infra/restore.sh` restaura
  um dump.
- Segredos via `.env` (com `.env.example` commitado), nunca no compose.

## API

Fastify em `apps/api`, tudo sob `/api`. Cookie de sessão `httpOnly`, `Secure`,
`SameSite=Lax`, na mesma origem do front: sem CORS e sem token no JavaScript.

### Autenticação

Montada pelo Better Auth em `/api/auth/*`.

- `POST /api/auth/sign-up/email`: e-mail, username, senha (mínimo 8). Cria a
  conta e envia e-mail de verificação. Até verificar, o usuário entra e usa a
  biblioteca, mas não consegue publicar link público.
- `POST /api/auth/sign-in`: `identifier` + senha. Rota própria que envolve a
  biblioteca: se `identifier` contém `@`, autentica por e-mail; senão, por
  username.
- `POST /api/auth/sign-out`, `GET /api/auth/session`.
- `POST /api/auth/forget-password` e `POST /api/auth/reset-password`: token
  por e-mail, válido por 1 hora.
- `POST /api/auth/send-verification-email` para reenviar.
- Cadastro e "esqueci a senha" respondem igual exista ou não o e-mail, para não
  revelar quem tem conta.

### Biblioteca (exige sessão)

| Rota | O que faz |
|---|---|
| `GET /api/automatons` | lista `id, name, kind, version, public_slug, updated_at` do usuário |
| `POST /api/automatons` | cria a partir de `{kind, name}` ou de `{document}` importado; valida com o motor |
| `GET /api/automatons/:id` | documento completo |
| `PUT /api/automatons/:id` | salva `{document, version}`; 409 em conflito |
| `DELETE /api/automatons/:id` | apaga |
| `POST /api/automatons/:id/publish` | gera `public_slug` (exige e-mail verificado) |
| `POST /api/automatons/:id/unpublish` | remove `public_slug` |
| `GET /api/workspace` | abas abertas e ativa |
| `PUT /api/workspace` | atualiza abas abertas e ativa |

### Computação (sessão opcional)

Recebem o documento no corpo, não o id, para funcionar em rascunhos não salvos
e em links públicos.

| Rota | Entrada | Saída |
|---|---|---|
| `POST /api/compute/validate` | `{document}` | `ValidationIssue[]` |
| `POST /api/compute/simulate` | `{document, input}` | `SimulationResult` completo |
| `POST /api/compute/simulate-batch` | `{document, inputs[]}` (máx. 200) | `{input, accepted, truncated}[]` |
| `POST /api/compute/nfa-to-dfa` | `{document}` | novo `Automaton` |
| `POST /api/compute/auto-layout` | `{document}` | `Record<stateId, {x, y}>` |

### Público (sem sessão)

`GET /api/public/:slug` devolve `{document, ownerUsername}` em leitura. Quem
tem conta duplica via `POST /api/automatons` com o documento recebido.

### Proteção

- Rate limit: 10/min por IP nas rotas de auth, 60/min em `compute`, 300/min no
  restante. Usuário logado tem limite por `user_id` em vez de IP.
- Os limites internos do motor (`MAX_STEPS`, `MAX_BRANCHES_PER_STEP`,
  `MAX_CLOSURE_EXPANSIONS`) garantem que nenhuma simulação passa de alguns
  milissegundos. Documento acima de 256 KB é rejeitado antes de chegar ao motor.
- Todo corpo passa por schema Zod de `packages/shared`. Erros voltam como
  `{error: {code, message}}` com códigos estáveis para o front traduzir.
- `@fastify/helmet` para cabeçalhos padrão.
- `GET /api/health` responde `{ok, db}` e é o healthcheck do container.

## Front

### Rotas

`react-router` com cinco rotas:

- `/login`, `/register`, `/reset-password`: formulários de conta.
- `/app`: editor com abas, exige sessão. Inclui a tela de biblioteca (lista
  com abrir, renomear, duplicar, publicar e apagar).
- `/p/:slug`: visualização pública, sem sessão.

Erro de rede ou `401` derruba para `/login` preservando a rota de destino.

### Cliente da API

`apps/web/src/api/client.ts`, uma função por rota, tipado pelos schemas de
`packages/shared`.

### Store

`useAutomatonStore` mantém a mesma forma, com quatro mudanças:

1. `persistAll` deixa de gravar no localStorage e enfileira um salvamento com
   debounce de 1,5 s por documento alterado. Cada documento ganha `version` e
   `saveState: 'saved' | 'saving' | 'error' | 'conflict'`, mostrado na aba.
   Fechar a janela com salvamento pendente dispara `beforeunload` e um `fetch`
   com `keepalive`.
2. `runSimulation` vira assíncrono: chama `compute/simulate`, mostra
   "simulando..." e preenche `simulationResult` quando chega. Passo a passo,
   autoplay, fita e pilha continuam locais, sobre o resultado recebido.
3. `ValidationBar` lê `doc.validationIssues`, preenchido pela API com debounce
   de 400 ms após cada edição. Enquanto aguarda, mostra a última resposta
   esmaecida. Se a rede falhar, mostra "não foi possível validar".
4. Conversão AFN→AFD e auto-layout chamam a API e aplicam o resultado como
   mutação normal, preservando undo/redo.

### Conflito de versão

Ao receber 409, o documento entra em `saveState: 'conflict'`, a aba fica
bloqueada para edição e um aviso oferece "Recarregar do servidor" (descarta o
local) ou "Manter minha cópia" (cria um novo autômato com o conteúdo local).

### Rótulos de transição

O parsing de texto continua local via `packages/shared`, então digitar
`a,b,D` responde na hora. A checagem contra alfabeto e as demais regras chegam
pela validação com debounce.

### Migração do localStorage

No primeiro login, se houver workspace antigo no navegador, o front oferece
"Importar N autômatos salvos neste navegador para sua conta". Após importar,
apaga a chave local.

### Modo público

`/p/:slug` carrega o documento e renderiza o canvas somente leitura, com
painel de simulação e testes em lote via `compute`. Se o visitante está logado,
aparece "Duplicar para minha biblioteca".

## Infra, dev e deploy

### Três formas de rodar

| Comando | O que sobe | Quando usar |
|---|---|---|
| `pnpm dev` | Postgres e Mailpit em container; API e web como processos locais com hot reload | dia a dia |
| `pnpm dev:docker` | tudo em container, API e web com hot reload via bind mount | testar o compose |
| `pnpm prod` | build completo: Postgres, API, web estático, Caddy, backup | VPS, ou ensaio local |

`pnpm dev` sobe `compose.dev.yaml` só com os serviços de infra e roda
`tsx watch` na API e `vite` no front em paralelo. API em `localhost:3000`,
Vite em `localhost:5173` com proxy de `/api`, então o cookie funciona como em
prod.

### Compose

- `compose.yaml`: `postgres`, `api`, `web`. Healthcheck no Postgres e
  `depends_on: condition: service_healthy` na API.
- `compose.dev.yaml`: adiciona `mailpit` (interface em `localhost:8025`),
  expõe Postgres em `127.0.0.1`, troca o comando da API para `tsx watch` e o
  do web para `vite`, monta o código com bind mount.
- `compose.prod.yaml`: adiciona `caddy` (80 e 443, volume para certificados)
  e `backup`, remove portas dos outros serviços, `restart: unless-stopped`.

### Dockerfiles

Um multi-stage por app. A API compila com `tsc` e roda em `node:22-alpine`
como usuário não-root, só com dependências de produção. O web faz `vite build`
e o resultado vai para uma imagem `caddy` que serve os estáticos e faz proxy
de `/api` para o container da API.

### Variáveis de ambiente

Em `.env`, com `.env.example` commitado e documentado:

```
DATABASE_URL, BETTER_AUTH_SECRET, APP_URL,
SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM,
POSTGRES_PASSWORD
```

A API se recusa a iniciar se faltar alguma, dizendo qual.

### E-mail

Nodemailer via SMTP. Em dev, Mailpit. Em prod, Resend ou outro SMTP, só
trocando variáveis.

### Deploy

`infra/deploy.sh` faz `git pull`, `docker compose -f compose.yaml -f
compose.prod.yaml up -d --build` e imprime `docker compose ps`. Migrações rodam
no start da API. Logs em JSON pelo logger do Fastify; `docker compose logs -f
api` é a ferramenta de diagnóstico.

## Testes

- `packages/engine` e `packages/shared`: testes atuais com Vitest, movidos
  junto com o código.
- `apps/api`: testes de integração com Vitest contra um Postgres real (banco
  `automaton_test` recriado por suite). Cobrem cadastro, login por e-mail e por
  username, verificação, reset, CRUD da biblioteca, o 409 de versão,
  publish/unpublish, acesso público, rate limit e cada rota de `compute` com um
  caso por tipo de autômato. E-mails vão para um transporte em memória.
- `apps/web`: testes de componente existentes continuam; cliente da API
  mockado com `msw`. Teste de build verifica que o bundle não contém marcadores
  do motor.
- Ponta a ponta com Playwright contra `pnpm dev:docker`: cadastra, verifica
  pelo Mailpit, cria um AFD, simula, publica, abre o link público anônimo.

## Ordem de entrega

Cada etapa deixa o sistema funcionando:

1. Monorepo e pacotes: mover motor e tipos; front igual; todos os testes
   passam.
2. API sem auth: Fastify, Postgres, migrações, rotas de `compute`, `pnpm dev`
   funcionando.
3. Front usando `compute`: validação, simulação, conversão e layout via API.
   O motor sai do bundle.
4. Auth: Better Auth, telas de login e cadastro, e-mail em dev via Mailpit.
5. Biblioteca e workspace no servidor, autosave com versão, migração do
   localStorage.
6. Link público e duplicar.
7. Infra de prod: Dockerfiles, Caddy, backup, script de deploy, teste ponta a
   ponta.
