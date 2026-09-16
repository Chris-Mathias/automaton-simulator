# Simulador de Autômatos — Autômato de Duas Pilhas (2PDA)

Data: 2026-09-16

Estende o spec de 2026-08-19 com um quinto tipo de autômato. Implementado no
repositório como está hoje (client-only); não depende do spec da plataforma
deployável e não é afetado por ele além do que já vale para o PDA.

## Visão geral

Um autômato de duas pilhas é um PDA não-determinístico cuja transição lê um
símbolo da entrada (ou ε) e faz uma operação `desempilha→empilha` em cada uma
das duas pilhas. Tem o poder de uma Máquina de Turing, o que o torna útil na
disciplina para mostrar o salto de expressividade entre uma e duas pilhas.

## Decisões fechadas

| Tema | Decisão |
|---|---|
| Modelagem | Novo tipo `'2PDA'` ao lado de `DFA`, `NFA`, `PDA`, `TM`. O PDA de uma pilha não muda |
| Sintaxe do rótulo | `a, Z→AZ \| Z→BZ`: barra separa as pilhas; cada lado é `desempilha→empilha` |
| Alfabeto de pilha | Um Γ (`stackAlphabet`) compartilhado pelas duas pilhas |
| Implementação | Campos aditivos (`pop2`, `push2`, `stack2`); sem migração de schema |
| Aceitação | Por estado final após consumir toda a entrada, como no PDA |
| Validação | Paridade com o PDA: nenhuma regra nova. O PDA hoje não checa pop/push contra Γ, e o 2PDA também não |

## Fora de escopo

- Generalizar para N pilhas. Duas já equivalem a uma MT; três não acrescentam
  poder, então o limite é definitivo, não provisório.
- Alfabeto por pilha.
- Aceitação por pilha vazia.
- Conversão entre 2PDA e MT.

## Modelo de dados e sintaxe

### Tipo

`AutomatonKind` ganha `'2PDA'`. `createEmptyAutomaton('2PDA')` inicia
`stackAlphabet: []`, igual ao PDA. `isAutomaton` aceita o novo valor.
`schemaVersion` continua 1: documentos antigos abrem sem migração.

### Transição

Dois campos opcionais novos em `Transition`, espelhando os existentes:

```ts
/** 2PDA only: symbol popped off the second stack. '' means no pop. */
pop2?: string;
/** 2PDA only: symbols pushed onto the second stack, top-of-stack first. '' means nothing pushed. */
push2?: string;
```

Uma transição de 2PDA sempre carrega os quatro campos (`pop`, `push`, `pop2`,
`push2`), com `''` onde não há operação. A pilha 1 usa `pop`/`push` sem
renomear, então nenhum código do PDA muda.

### Rótulo desenhado

`formatTransitionLabel('2PDA', t)` produz `a, Z→AZ | Z→BZ`, com `ε` no lugar
de `''`. `formatTransitionLabels` separa transições do mesmo par com `; `,
como no PDA (o rótulo contém vírgulas).

### Sintaxe digitada

Em `transitionSyntax.ts`:

- `TWO_STACK_SYNTAX_PLACEHOLDER = 'lê, desempilha>empilha | desempilha>empilha'`.
- `TwoStackTriple = { input, pop, push, pop2, push2 }`.
- `formatTwoStackTransitions(triples)` e `parseTwoStackTransitions(text)`,
  com o mesmo `ParseResult` discriminado (`ok: true, triples` ou
  `ok: false, error`) do PDA.

Regras do parser, por entrada separada por `;`:

1. Exatamente uma `|`. Sem barra: erro "faltou a barra separando as duas
   pilhas". Mais de uma: erro "só há duas pilhas".
2. O lado esquerdo da barra é `lê, desempilha→empilha`; o direito é só
   `desempilha→empilha`. Cada lado tem exatamente uma seta, aceitando `→`,
   `->` e `>` como o parser de PDA já aceita.
3. Apelidos de ε (`eps`, `epsilon`, `vazio`) valem em todas as posições.
4. `pop` e `pop2` de mais de um caractere são rejeitados com a mesma mensagem
   do PDA ("sai um símbolo por vez da pilha").
5. Nenhuma das cinco partes pode ficar vazia; escreve-se ε onde não há
   símbolo.
6. Uma quíntupla repetida na mesma entrada é rejeitada.

O parsing de `desempilha→empilha` é extraído do parser de PDA para uma
função interna `parseStackOp(text): { ok: true, pop, push } | { ok: false,
error }`, usada pelos dois parsers, para as mensagens não divergirem.

## Motor

### Simulação

`SimulationBranch` ganha `stack2?: string[]`, presente só em ramos de 2PDA
(topo em `stack2[0]`, como `stack`). Em `simulate.ts`:

- `branchKey(stateId, stack, stack2?)` passa a incluir a segunda pilha:
  `${stateId}::${stack.join('')}::${stack2.join('')}`. Duas configurações com
  a mesma pilha 1 e pilhas 2 diferentes são ramos distintos.
- Onde hoje há `automaton.kind === 'PDA' && !popMatches(t.pop, branch.stack)`,
  passa a existir um `stackOpsMatch(automaton, t, branch)` que, para PDA,
  checa `pop` contra `stack` e, para 2PDA, checa `pop` contra `stack` e
  `pop2` contra `stack2`. As duas condições precisam valer: a transição só
  dispara se puder operar nas duas pilhas.
- `applyStackOp` é chamada uma vez por pilha; o ramo resultante carrega
  `stack` e `stack2` novos. A pilha 2 de um ramo inicial começa vazia.
- Fecho-ε, `parentKey`, `deadBranches`, limites (`MAX_STEPS`,
  `MAX_BRANCHES_PER_STEP`, `MAX_CLOSURE_EXPANSIONS`) e aceitação valem sem
  alteração.

### Validação

`validate.ts` não tem bloco específico de PDA hoje, e o 2PDA segue igual: as
regras gerais (estado inicial, aceitação, alcançabilidade, símbolo lido no
alfabeto) já se aplicam por não dependerem de `kind`.

### Edição de rótulo

Em `labelEditing.ts`, `planTwoStackEdit(automaton, from, to, text)` espelha
`planPdaEdit`:

- Chave de reconciliação: `input|pop|push|pop2|push2`. Transições existentes
  cuja chave não aparece no texto são removidas; quíntuplas do texto sem
  transição existente são adicionadas. `update` fica vazio, como no PDA.
- `newInputSymbols`: símbolos lidos (exceto ε) fora de `alphabet`.
- `newStackSymbols`: cada caractere de `pop`, `push`, `pop2` e `push2` fora
  de `stackAlphabet`. Um único conjunto, porque Γ é compartilhado.

A extração do `parseStackOp` e do cálculo de `newStackSymbols` para funções
internas reutilizadas por `planPdaEdit` e `planTwoStackEdit` é parte da
tarefa, para os dois não divergirem.

### Conversão e layout

`convertNfaToDfa` já rejeita tudo que não é NFA. `autoLayout` não olha `kind`.
Nada a fazer.

## Interface

### Criar

`NewAutomatonDialog`: nova opção `2PDA: 'AP2 — Autômato de Duas Pilhas'`.
`TabBar`: badge `AP2`. Os badges não têm cor por tipo hoje, e o AP2 segue
igual aos demais.

### Canvas

`Canvas.tsx`, no objeto `labelEditor`: novo ramo para `'2PDA'` com
`TWO_STACK_SYNTAX_PLACEHOLDER`, `validateText` via `parseTwoStackTransitions`,
`format` via `formatTwoStackTransitions` e `commit` via `planTwoStackEdit`.
O `commit` reaproveita o mesmo tratamento de `newStackSymbols` e
`newInputSymbols` que o ramo de PDA faz hoje; esse tratamento é extraído para
uma função local usada pelos dois ramos.

### Toolbar

O campo "Alfabeto de pilha" aparece para `kind === 'PDA' || kind === '2PDA'`.
Nenhum campo novo.

### Tabela de transições

`TransitionList`: para 2PDA, as colunas passam a ser
`De | Para | Lê | Pilha 1: desempilha | empilha | Pilha 2: desempilha | empilha`.
Os inputs de `pop2`/`push2` são os mesmos componentes dos de `pop`/`push`,
ligados a `updateTransition(t.id, { pop2 })` e `{ push2 }`. O formulário de
nova transição na tabela ganha os dois campos extras quando o tipo é 2PDA.

### Painel de simulação

`SimulatePanel`: o chip de cada ramo, que para PDA mostra `[Z A]`, para 2PDA
mostra `[Z A] [B]` (pilha 1 e pilha 2, "vazia" quando não há nada).

### Faixa de pilhas

`StackStrip` passa a renderizar para `kind === 'PDA' || kind === '2PDA'`.
Cada `StackCard` de 2PDA desenha as duas pilhas lado a lado dentro do mesmo
cartão, com um rótulo discreto `1` e `2` acima de cada uma. A animação de
pop/push (`stackDiff`) roda por pilha, comparando `stack` com `parent.stack`
e `stack2` com `parent.stack2`. A profundidade usada para fixar a altura da
faixa considera as duas pilhas. O rótulo da transição no rodapé do cartão usa
`formatTransitionLabel(automaton.kind, t)` em vez do `'PDA'` fixo de hoje.

### Export/import e imagem

O JSON exportado carrega `pop2`/`push2` naturalmente. `isAutomaton` aceita o
tipo. `exportImage` desenha o rótulo pelo `formatTransitionLabels`, então já
sai certo.

## Testes

Todos com Vitest, seguindo os arquivos existentes:

- `transitionSyntax.test.ts`: parse e format de 2PDA. Casos: entrada válida
  com as duas operações; ε em cada posição via apelidos; `->` e `>` como
  seta; sem barra; duas barras; lado sem seta; parte vazia; `pop` longo;
  quíntupla repetida; ida e volta `format(parse(x)) === x` normalizado. E o
  PDA continua passando após a extração de `parseStackOp`.
- `simulate.test.ts`: 2PDA que reconhece `aⁿbⁿcⁿ` (não é livre de contexto,
  então prova que a segunda pilha faz diferença); ramo que morre porque só
  uma das pilhas casa o `pop`; fecho-ε operando as duas pilhas; duas
  configurações que diferem só na pilha 2 permanecem ramos distintos;
  `parentKey` e `deadBranches` preenchidos.
- `labelEditing.test.ts`: `planTwoStackEdit` adiciona, remove e mantém por
  quíntupla; `newStackSymbols` reúne símbolos das duas pilhas sem repetir;
  texto inválido retorna `null`.
- `validate.test.ts`: `createEmptyAutomaton('2PDA')` começa com Γ vazio.
- `StackStrip.test.tsx`: cartão de 2PDA mostra as duas pilhas; pilha 2 vazia
  mostra "vazia"; animação de push marca só a pilha que mudou.
- `Toolbar.test.tsx`: campo de alfabeto de pilha aparece para 2PDA.

## Ordem de entrega

Cada passo termina em commit com os testes passando:

1. Tipo `'2PDA'`, campos `pop2`/`push2`, `createEmptyAutomaton`,
   `isAutomaton`, `formatTransitionLabel(s)`.
2. Extrair `parseStackOp` do parser de PDA (sem mudar comportamento).
3. `parseTwoStackTransitions` e `formatTwoStackTransitions`.
4. Motor: `stack2`, `branchKey`, `stackOpsMatch`, aplicação nas duas pilhas.
5. `planTwoStackEdit`, com as funções internas compartilhadas com
   `planPdaEdit`.
6. Criar e identificar: `NewAutomatonDialog`, `TabBar`, Toolbar.
7. Canvas: ramo `2PDA` no `labelEditor`.
8. Tabela de transições e chips do painel de simulação.
9. `StackStrip` com duas pilhas por cartão.
