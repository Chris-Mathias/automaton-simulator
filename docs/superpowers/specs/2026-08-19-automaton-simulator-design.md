# Simulador de Autômatos — Design Spec

Data: 2026-08-19

## Visão geral

Aplicação web client-only para criar e simular autômatos (AFD, AFN e Autômato
de Pilha/PDA) visualmente, no estilo do diagrama clássico de referência
(`Imagem colada.png`): estados como círculos, estado de aceitação como
círculo duplo, transições como setas rotuladas. Uso principal: estudo/entrega
de trabalho da disciplina de Teoria da Computação.

## Objetivos

- Editor visual, colorido e interativo para montar autômatos por
  clique/arrastar.
- Simulação passo a passo com autoplay, destacando estado(s) ativo(s) e
  transição percorrida.
- Conversão AFN → AFD (construção de subconjuntos).
- Validação automática do autômato com avisos visuais.
- Salvar/carregar via export/import JSON, com autosave local
  (localStorage).
- Visual moderno/técnico, tema escuro por padrão com alternância para claro.

## Fora de escopo (YAGNI)

- Máquina de Turing.
- Contas de usuário, sincronização em nuvem, colaboração multi-usuário.
- Minimização de AFD.
- Conversão regex ↔ autômato.

## Stack

- Vite + React 18 + TypeScript.
- **React Flow** (`@xyflow/react`) para o canvas do grafo — evita
  reimplementar do zero drag/pan/zoom, roteamento de arestas paralelas
  (ex.: q1↔q2 em sentidos opostos) e self-loops; nós e arestas totalmente
  customizados para manter o visual desejado (círculo simples/duplo,
  cores de destaque durante simulação).
- **Zustand** para o estado do editor (evita prop-drilling entre
  canvas / tabela de transições / painel de simulação).
- **Vitest** para testes unitários da engine (lógica pura, sem UI).
- CSS puro com tokens de design (variáveis CSS para cores/tema), sem UI
  kit pesado, para manter controle total da estética.
- Sem backend; build estático (deployável em GitHub Pages ou qualquer
  hospedagem estática).

## Modelo de dados canônico

O autômato tem uma representação serializável independente do React Flow;
um adaptador fino traduz entre esse modelo e os nós/arestas do React Flow.

```ts
type AutomatonKind = 'DFA' | 'NFA' | 'PDA';

interface AutomatonState {
  id: string;
  label: string;
  position: { x: number; y: number };
  isStart: boolean;
  isAccept: boolean;
}

interface Transition {
  id: string;
  from: string;
  to: string;
  input: string;       // símbolo do alfabeto, ou 'ε' para epsilon (AFN/PDA)
  pop?: string;         // PDA: símbolo desempilhado ('' = ε, nada desempilhado)
  push?: string;        // PDA: símbolo(s) empilhado(s) ('' = ε, nada empilhado)
}

interface Automaton {
  schemaVersion: 1;
  id: string;
  name: string;
  kind: AutomatonKind;
  alphabet: string[];
  stackAlphabet?: string[]; // apenas PDA
  states: AutomatonState[];
  transitions: Transition[];
  startStateId: string | null;
}
```

O `kind` é fixado na criação do autômato (não faz sentido "converter" um
grafo já desenhado de PDA para AFD in-place); a conversão AFN→AFD gera um
**novo** `Automaton` de kind `'DFA'`.

## Engine (funções puras, testadas isoladamente da UI)

- `simulate(automaton, input): SimulationTrace`
  - Pré-computa a trilha completa de execução (não incremental), onde cada
    passo guarda: o(s) branch(es) ativo(s) (estado + pilha, se PDA + resto
    da entrada), a transição usada para chegar ali, e se é um beco sem
    saída. Para AFN/PDA, um "passo" é o conjunto de configurações ativas
    (busca sobre as escolhas não-determinísticas, com epsilon-closure).
  - Critério de aceitação do PDA: **aceitação por estado final** (não por
    pilha vazia) — mais simples e é o padrão usado em exercícios de curso.
  - Ter a trilha inteira pré-computada torna step/back/autoplay/velocidade
    triviais: são apenas navegação de índice num array, sem
    re-simulação.
  - Limite de passos (ex.: 1000) para proteger contra ciclos infinitos em
    grafos com transições ε cíclicas.
- `validate(automaton): ValidationIssue[]`
  - Sem estado inicial, sem estado de aceitação, estados inalcançáveis,
    transições "penduradas" (referenciando estado inexistente),
    incompletude de AFD (falta transição para algum símbolo em algum
    estado) e não-determinismo indevido em AFD (duas transições pelo
    mesmo símbolo saindo do mesmo estado).
- `convertNfaToDfa(nfa): Automaton`
  - Construção de subconjuntos com epsilon-closure; estados do DFA gerado
    são rotulados pelo conjunto de origem (ex. `"{q1,q2}"`).

## UX do editor

- **Canvas (React Flow), centro da tela**: clique em área vazia cria um
  estado; arrastar de um estado a outro cria uma transição (abre um
  popover pequeno para escolher símbolo, ou pop/push no caso de PDA);
  duplo-clique no estado renomeia/alterna aceitação; ação de toolbar/menu
  de contexto marca o estado inicial (renderizado com uma seta de
  "entrada" vindo do vazio, convenção padrão de livros-texto).
- **Toolbar (topo)**: escolha do tipo de autômato ao criar um novo, editor
  de alfabeto (lista de símbolos), botões Novo / Importar / Exportar,
  alternância de tema claro/escuro.
- **Painel lateral (direita, recolhível)**, com abas:
  - *Tabela de transições*: grid editável espelhando o canvas (edição em
    qualquer um dos dois lados reflete no outro).
  - *Simular*: campo de string de entrada, botões Play/Pausa/Passo/Voltar/
    Reiniciar, slider de velocidade, destaque do(s) estado(s) ativo(s) no
    canvas em cor diferenciada, visualização da pilha (widget vertical)
    quando for PDA, banner de aceito/rejeitado ao final da trilha.
- **Faixa de validação**: lista os problemas retornados por `validate()`;
  clicar num item centraliza/destaca o estado ou aresta correspondente no
  canvas.
- **Linguagem de cor**: estado inicial = borda de cor distinta; estado(s)
  de aceitação = círculo duplo + cor de destaque; ativo durante simulação
  = brilho/realce animado; inválido = contorno vermelho; normal = neutro.

## Persistência

- Autosave em `localStorage` (debounce ~500ms) do autômato em edição;
  restaura a última sessão ao reabrir a página.
- Exportar baixa um arquivo `.json` no formato `Automaton` acima (com
  `schemaVersion`); Importar lê um arquivo e valida seu formato antes de
  carregar (rejeita com mensagem clara se o schema não bater).

## Testes

- Testes unitários (Vitest) de `simulate`, `validate` e
  `convertNfaToDfa`, cobrindo casos de AFD, AFN e PDA — incluindo o
  autômato do diagrama de referência (q1→q2 em 0, q2→q1 em 1, q2→q3 em 1,
  q1→q3 em 0, q3→qf em 1) como caso de teste de regressão.
- Verificação manual na UI via servidor de dev: montar o autômato de
  referência no editor à mão, rodar algumas strings de entrada e conferir
  que o destaque/aceite-rejeite bate com o esperado.
