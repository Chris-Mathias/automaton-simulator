# Simulador de Autômatos

Aplicação web client-only para criar e simular autômatos visualmente. Editor com canvas interativo (clique/arrastar), simulação passo a passo com autoplay, validação automática e persistência local.

## Tipos de autômato

| Tipo | Descrição |
|------|-----------|
| **AFD** | Autômato Finito Determinístico |
| **AFN** | Autômato Finito Não-Determinístico (com ε-transições) |
| **PDA** | Autômato de Pilha (uma pilha, aceitação por estado final) |
| **2PDA** | Autômato de Duas Pilhas (não-determinístico, poder de MT) |
| **MT** | Máquina de Turing (fita única, determinística) |

## Funcionalidades

- **Editor visual**: clique em área vazia cria estado; arrastar entre estados cria transição; duplo-clique renomeia/alterna aceitação.
- **Rótulos editáveis no canvas**: AFD/AFN aceitam lista de símbolos separados por vírgula; PDA usa `lê,desempilha>empilha`; 2PDA usa `lê,desempilha>empilha | desempilha>empilha`; MT usa `lê,escreve,move` (E/D/P).
- **Simulação passo a passo**: play/pausa/passo/voltar/reiniciar, slider de velocidade, destaque de estado(s) ativo(s), visualização de pilha(s) e fita.
- **Conversão AFN → AFD**: construção de subconjuntos com epsilon-closure.
- **Validação automática**: avisos de estados inalcançáveis, transições pendentes, incompletude de AFD, não-determinismo indevido, etc.
- **Tabela de transições**: grid editável espelhando o canvas.
- **Persistência**: autosave em `localStorage` (debounce ~500ms), export/import JSON.
- **Tema claro/escuro**.

## Como executar

### Pré-requisitos

- Node.js 20+
- pnpm 9+

### Comandos

```bash
# Instalar dependências
pnpm install

# Servidor de desenvolvimento (http://localhost:5173)
pnpm dev

# Testes
pnpm test          # suite completa
pnpm test:watch    # modo watch

# Type check
pnpm exec tsc -b

# Lint
pnpm lint

# Build de produção (dist/)
pnpm build

# Preview do build
pnpm preview
```

## Stack

- **Vite 8** + **React 19** + **TypeScript**
- **React Flow** (`@xyflow/react`) — canvas do grafo
- **Zustand** — estado do editor
- **Vitest** + Testing Library — testes unitários
- **oxlint** — linter

## Estrutura

```
src/
  types/          Modelo de dados canônico (Automaton, Transition, ...)
  engine/         Lógica pura: simulate, validate, convertNfaToDfa, autoLayout, parsers
  store/          Store Zustand (estado do editor, autosave)
  persistence/    Export/import JSON, export PNG, storage localStorage
  components/     UI: Canvas, Toolbar, SidePanel, TabBar, Dialogs
docs/superpowers/  Specs e planos de design
```

## Documentação

Especificações e planos de implementação em [`docs/superpowers/`](docs/superpowers/):

- [Spec do Simulador](docs/superpowers/specs/2026-08-19-automaton-simulator-design.md) — visão geral, modelo de dados, engine, UX
- [Spec Plataforma Deployável](docs/superpowers/specs/2026-09-16-deployable-platform-design.md) — monorepo com backend, auth, banco de dados
- [Spec 2PDA](docs/superpowers/specs/2026-09-16-two-stack-pda-design.md) — autômato de duas pilhas
- [Plano 2PDA](docs/superpowers/plans/2026-09-16-two-stack-pda.md) — plano de implementação do 2PDA
