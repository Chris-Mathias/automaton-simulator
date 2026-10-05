# Autômato de Duas Pilhas (2PDA) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar o tipo `2PDA` (autômato de duas pilhas) ao simulador: criar, editar pelo rótulo, simular passo a passo e visualizar as duas pilhas.

**Architecture:** Campos aditivos sobre o que o PDA já tem: `pop2`/`push2` na transição e `stack2` no ramo de simulação. Cada lugar que hoje ramifica por `kind === 'PDA'` passa a tratar também `'2PDA'`, e o parsing de `desempilha→empilha` é extraído para uma função compartilhada pelos dois parsers. Nenhuma migração de schema.

**Tech Stack:** TypeScript, React 19, Zustand, Vitest + Testing Library, oxlint, pnpm.

**Spec:** `docs/superpowers/specs/2026-09-16-two-stack-pda-design.md`

## Global Constraints

- Commits em pt-BR, Conventional Commits, corpo com o porquê, sem trailers de coautoria (`CLAUDE.md`).
- Identificadores em inglês; strings para o usuário em português.
- O PDA de uma pilha não muda de comportamento: todos os testes atuais continuam passando sem alteração de expectativa.
- `schemaVersion` continua `1`.
- Comandos: `pnpm test` (suite toda), `pnpm vitest run <arquivo>` (um arquivo), `pnpm exec tsc -b` (tipos), `pnpm lint`.

---

## Mapa de arquivos

| Arquivo | Responsabilidade nesta feature |
|---|---|
| `src/types/automaton.ts` | tipo `'2PDA'`, campos `pop2`/`push2`, `hasStack(kind)`, rótulo desenhado |
| `src/types/automaton.test.ts` (novo) | testes do modelo e do rótulo |
| `src/engine/transitionSyntax.ts` | `parseStackOp` compartilhado; `parseTwoStackTransitions`/`formatTwoStackTransitions` |
| `src/engine/transitionSyntax.test.ts` | testes do parser de duas pilhas |
| `src/engine/simulate.ts` | `stack2`, `branchKey`, `stackOpsMatch`, `applyStackOps` |
| `src/engine/simulate.test.ts` | 2PDA para aⁿbⁿcⁿ e casos de ramificação |
| `src/engine/labelEditing.ts` | `planTwoStackEdit` e helpers compartilhados com `planPdaEdit` |
| `src/engine/labelEditing.test.ts` | testes de reconciliação |
| `src/components/Dialogs/NewAutomatonDialog.tsx` | opção "AP2" |
| `src/components/TabBar/TabBar.tsx` | badge "AP2" |
| `src/components/Toolbar/Toolbar.tsx` | campo de alfabeto de pilha para 2PDA |
| `src/components/Toolbar/Toolbar.test.tsx` | teste do campo |
| `src/components/Canvas/Canvas.tsx` | ramo `2PDA` no `labelEditor` |
| `src/components/SidePanel/TransitionList.tsx` | colunas da pilha 2 |
| `src/components/SidePanel/SimulatePanel.tsx` | chip com as duas pilhas |
| `src/components/Canvas/StackStrip.tsx` + `.css` + `.test.tsx` | duas colunas por cartão |

---

### Task 1: Tipo `2PDA` no modelo de dados e rótulo desenhado

**Files:**
- Modify: `src/types/automaton.ts`
- Modify: `src/components/Dialogs/NewAutomatonDialog.tsx:5-10`
- Create: `src/types/automaton.test.ts`

**Interfaces:**
- Produces: `AutomatonKind` inclui `'2PDA'`; `Transition.pop2?: string`, `Transition.push2?: string`; `hasStack(kind: AutomatonKind): boolean`; `formatTransitionLabel('2PDA', t)` retorna `a, Z→AZ | ε→B`.

- [ ] **Step 1: Escrever os testes que falham**

Criar `src/types/automaton.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  EPSILON,
  createEmptyAutomaton,
  formatTransitionLabel,
  formatTransitionLabels,
  hasStack,
  isAutomaton,
  type Transition,
} from './automaton';

function twoStack(overrides: Partial<Transition>): Transition {
  return { id: 't', from: 'q0', to: 'q1', input: 'a', pop: '', push: '', pop2: '', push2: '', ...overrides };
}

describe('2PDA model', () => {
  it('starts with an empty shared stack alphabet and no tape', () => {
    const automaton = createEmptyAutomaton('2PDA');
    expect(automaton.stackAlphabet).toEqual([]);
    expect(automaton.tapeAlphabet).toBeUndefined();
  });

  it('counts as a stack automaton alongside the PDA', () => {
    expect(hasStack('PDA')).toBe(true);
    expect(hasStack('2PDA')).toBe(true);
    expect(hasStack('DFA')).toBe(false);
    expect(hasStack('NFA')).toBe(false);
    expect(hasStack('TM')).toBe(false);
  });

  it('is accepted by the import guard', () => {
    expect(isAutomaton(createEmptyAutomaton('2PDA'))).toBe(true);
  });
});

describe('formatTransitionLabel - 2PDA', () => {
  it('renders both stack operations separated by a bar', () => {
    const t = twoStack({ pop: 'Z', push: 'AZ', push2: 'B' });
    expect(formatTransitionLabel('2PDA', t)).toBe(`a, Z→AZ | ${EPSILON}→B`);
  });

  it('renders an absent operation on both stacks as epsilon', () => {
    expect(formatTransitionLabel('2PDA', twoStack({}))).toBe(`a, ${EPSILON}→${EPSILON} | ${EPSILON}→${EPSILON}`);
  });

  it('separates the transitions of one edge with semicolons, since each already has commas', () => {
    const a = twoStack({ id: 'a', pop: 'Z', push: 'AZ' });
    const b = twoStack({ id: 'b', input: 'b', pop2: 'B' });
    expect(formatTransitionLabels('2PDA', [a, b])).toBe(
      `a, Z→AZ | ${EPSILON}→${EPSILON}; b, ${EPSILON}→${EPSILON} | B→${EPSILON}`,
    );
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run src/types/automaton.test.ts`
Expected: FAIL. `hasStack` não existe e `'2PDA'` não é um `AutomatonKind` (erro de tipo do Vitest/esbuild não impede a execução, mas `hasStack is not a function` derruba o primeiro `describe`).

- [ ] **Step 3: Implementar no modelo**

Em `src/types/automaton.ts`:

Linha 1, o tipo:

```ts
export type AutomatonKind = 'DFA' | 'NFA' | 'PDA' | '2PDA' | 'TM';
```

Logo abaixo de `TAPE_MOVE_LABELS`, o helper:

```ts
/** Kinds whose configurations carry a stack: the one-stack PDA and the two-stack 2PDA. */
export function hasStack(kind: AutomatonKind): boolean {
  return kind === 'PDA' || kind === '2PDA';
}
```

Em `Transition`, depois de `push?: string;`:

```ts
  /** 2PDA only: symbol popped off the second stack. '' means no pop. */
  pop2?: string;
  /** 2PDA only: symbols pushed onto the second stack, top-of-stack first. '' means nothing pushed. */
  push2?: string;
```

Em `createEmptyAutomaton`, trocar a linha do `stackAlphabet`:

```ts
    stackAlphabet: hasStack(kind) ? [] : undefined,
```

Em `formatTransitionLabel`, logo após o `if (kind === 'PDA') ...`:

```ts
  if (kind === '2PDA') {
    return `${t.input}, ${t.pop || EPSILON}→${t.push || EPSILON} | ${t.pop2 || EPSILON}→${t.push2 || EPSILON}`;
  }
```

Em `formatTransitionLabels`, trocar o separador:

```ts
  const separator = kind === 'TM' || hasStack(kind) ? '; ' : ', ';
```

Em `isAutomaton`, na checagem de `kind`:

```ts
    (v.kind === 'DFA' || v.kind === 'NFA' || v.kind === 'PDA' || v.kind === '2PDA' || v.kind === 'TM') &&
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm vitest run src/types/automaton.test.ts src/engine/validate.test.ts`
Expected: PASS em ambos.

- [ ] **Step 5: Manter o diálogo de criação compilando**

`KIND_LABELS` em `src/components/Dialogs/NewAutomatonDialog.tsx` é um `Record<AutomatonKind, string>`, então o tipo novo exige a entrada já aqui (a opção fica visível no diálogo a partir deste commit, o que é aceitável: criar um AP2 vazio já funciona):

```ts
const KIND_LABELS: Record<AutomatonKind, string> = {
  DFA: 'AFD — Autômato Finito Determinístico',
  NFA: 'AFN — Autômato Finito Não-Determinístico',
  PDA: 'PDA — Autômato de Pilha',
  '2PDA': 'AP2 — Autômato de Duas Pilhas',
  TM: 'MT — Máquina de Turing',
};
```

- [ ] **Step 6: Tipos e commit**

Run: `pnpm exec tsc -b`
Expected: sem erros. (`TransitionList`, `Toolbar` e `StackStrip` ainda comparam `kind === 'PDA'`, o que continua válido.)

```bash
git add src/types/automaton.ts src/types/automaton.test.ts src/components/Dialogs/NewAutomatonDialog.tsx
git commit -m "feat(types): adicionar o tipo 2PDA com operações na segunda pilha" -m "Um autômato de duas pilhas tem o poder de uma Máquina de Turing, e a disciplina usa isso para mostrar o salto entre uma e duas pilhas. Os campos são aditivos sobre o PDA, então nenhum documento salvo precisa migrar."
```

---

### Task 2: Extrair o parsing de `desempilha→empilha` do parser de PDA

**Files:**
- Modify: `src/engine/transitionSyntax.ts:108-198`
- Test: `src/engine/transitionSyntax.test.ts` (sem alteração; é a rede de segurança)

**Interfaces:**
- Produces (internas ao módulo): `splitArrow(text, entry, placeholder)` e `parseStackOp(popRaw, pushRaw, entry)`, usadas pela Task 3.

- [ ] **Step 1: Confirmar que a rede de segurança está verde**

Run: `pnpm vitest run src/engine/transitionSyntax.test.ts`
Expected: PASS.

- [ ] **Step 2: Refatorar**

Em `src/engine/transitionSyntax.ts`, substituir tudo entre a linha `export const PDA_SYNTAX_PLACEHOLDER = ...` e o fim de `parsePdaTransitions` por:

```ts
export const PDA_SYNTAX_PLACEHOLDER = 'lê,desempilha>empilha';

/** The editable text for a group of transitions: `a,Z→AZ; b,A→ε`. */
export function formatPdaTransitions(transitions: PdaTriple[]): string {
  return transitions
    .map((t) => `${t.input || EPSILON},${t.pop || EPSILON}${STACK_ARROW}${t.push || EPSILON}`)
    .join('; ');
}

export type PdaParseResult = { ok: true; triples: PdaTriple[] } | { ok: false; error: string };

type ParseFailure = { ok: false; error: string };

function emptyPartError(entry: string): ParseFailure {
  return {
    ok: false,
    error: `Em "${entry}", nenhuma das partes pode ficar vazia — escreva ${EPSILON} onde não há símbolo.`,
  };
}

/** Splits `x→y` on its arrow, rejecting anything but exactly one arrow. */
function splitArrow(
  text: string,
  entry: string,
  placeholder: string,
): { ok: true; left: string; right: string } | ParseFailure {
  const sides = text.split(STACK_ARROW_PATTERN);
  if (sides.length !== 2) {
    return {
      ok: false,
      error: `"${entry}" precisa de uma seta separando o que sai e o que entra na pilha: ${placeholder}.`,
    };
  }
  return { ok: true, left: sides[0], right: sides[1] };
}

/**
 * One `desempilha→empilha` operation, shared by the one- and two-stack parsers
 * so they never disagree on what a stack action may look like.
 */
function parseStackOp(popRaw: string, pushRaw: string, entry: string): { ok: true; pop: string; push: string } | ParseFailure {
  const pop = normalizeSymbol(popRaw.trim());
  const push = normalizeSymbol(pushRaw.trim());

  if (!pop || !push) return emptyPartError(entry);

  // The engine pops a single symbol (`stack[0] === pop`) and pushes one per
  // character (`push.split('')`), so a longer pop could never match anything
  // that was pushed. Rejecting it here makes that limit visible instead of
  // producing a transition that silently never fires.
  if (pop !== EPSILON && pop.length !== 1) {
    return {
      ok: false,
      error: `"${pop}" não serve para desempilhar: sai um símbolo por vez da pilha.`,
    };
  }

  return { ok: true, pop: pop === EPSILON ? '' : pop, push: push === EPSILON ? '' : push };
}

/**
 * Parses what the user typed on a PDA transition label. Unlike the Turing
 * parser, repeating an input symbol is allowed: a PDA is non-deterministic, so
 * `a,Z→AZ; a,Z→ε` is a legitimate pair of choices. Only an exactly repeated
 * triple is rejected, since it would add nothing.
 */
export function parsePdaTransitions(text: string): PdaParseResult {
  const entries = text
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean);

  const triples: PdaTriple[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    const arrow = splitArrow(entry, entry, PDA_SYNTAX_PLACEHOLDER);
    if (!arrow.ok) return arrow;

    const readParts = arrow.left.split(',').map((part) => part.trim());
    if (readParts.length !== 2) {
      return {
        ok: false,
        error: `Em "${entry}", antes da seta vêm duas partes separadas por vírgula: o símbolo lido e o desempilhado.`,
      };
    }

    const input = normalizeSymbol(readParts[0]);
    if (!input) return emptyPartError(entry);

    const op = parseStackOp(readParts[1], arrow.right, entry);
    if (!op.ok) return op;

    const triple: PdaTriple = { input, pop: op.pop, push: op.push };

    const key = `${triple.input}|${triple.pop}|${triple.push}`;
    if (seen.has(key)) {
      return { ok: false, error: `"${entry}" aparece duas vezes aqui.` };
    }
    seen.add(key);

    triples.push(triple);
  }

  return { ok: true, triples };
}
```

A única mudança visível é a mensagem de parte vazia, que deixa de dizer "três partes" para servir também ao parser de cinco partes. O teste existente só verifica que contém "vazia".

- [ ] **Step 3: Rodar e ver passar**

Run: `pnpm vitest run src/engine/transitionSyntax.test.ts src/engine/labelEditing.test.ts`
Expected: PASS, sem alteração nos testes.

- [ ] **Step 4: Commit**

```bash
git add src/engine/transitionSyntax.ts
git commit -m "refactor(engine): isolar o parsing de uma operação de pilha" -m "O autômato de duas pilhas precisa interpretar duas operações por transição com as mesmas regras e mensagens do PDA. Com a operação num só lugar, os dois parsers não têm como divergir."
```

---

### Task 3: Parser e formatador da sintaxe de duas pilhas

**Files:**
- Modify: `src/engine/transitionSyntax.ts` (fim do arquivo)
- Test: `src/engine/transitionSyntax.test.ts`

**Interfaces:**
- Consumes: `splitArrow`, `parseStackOp`, `emptyPartError` (Task 2).
- Produces: `TwoStackTriple { input, pop, push, pop2, push2 }`; `TWO_STACK_SYNTAX_PLACEHOLDER`; `parseTwoStackTransitions(text): TwoStackParseResult`; `formatTwoStackTransitions(triples): string`.

- [ ] **Step 1: Escrever os testes que falham**

No topo de `src/engine/transitionSyntax.test.ts`, acrescentar ao import:

```ts
import {
  formatPdaTransitions,
  formatTuringTransitions,
  formatTwoStackTransitions,
  normalizeTapeSymbol,
  parsePdaTransitions,
  parseTuringTransitions,
  parseTwoStackTransitions,
} from './transitionSyntax';
```

No fim do arquivo:

```ts
function twoStackTriples(text: string) {
  const parsed = parseTwoStackTransitions(text);
  if (!parsed.ok) throw new Error(`esperava sucesso, veio: ${parsed.error}`);
  return parsed.triples;
}

function twoStackError(text: string) {
  const parsed = parseTwoStackTransitions(text);
  if (parsed.ok) throw new Error('esperava erro, mas o texto foi aceito');
  return parsed.error;
}

describe('parseTwoStackTransitions', () => {
  it('reads one operation per stack, separated by a bar', () => {
    expect(twoStackTriples('a, Z>AZ | Z>BZ')).toEqual([{ input: 'a', pop: 'Z', push: 'AZ', pop2: 'Z', push2: 'BZ' }]);
  });

  it('accepts every spelling of the arrow on either side', () => {
    const expected = [{ input: 'a', pop: 'Z', push: 'A', pop2: 'B', push2: '' }];
    expect(twoStackTriples('a,Z>A|B>ε')).toEqual(expected);
    expect(twoStackTriples('a,Z->A|B->ε')).toEqual(expected);
    expect(twoStackTriples('a,Z→A|B→ε')).toEqual(expected);
  });

  it('expands typed aliases for epsilon in all five parts', () => {
    expect(twoStackTriples('eps, vazio>epsilon | eps>vazio')).toEqual([
      { input: EPSILON, pop: '', push: '', pop2: '', push2: '' },
    ]);
  });

  it('reads several entries separated by semicolons, ignoring spacing', () => {
    expect(twoStackTriples(' a,ε>A|ε>ε ;  b,A>ε|ε>B ')).toEqual([
      { input: 'a', pop: '', push: 'A', pop2: '', push2: '' },
      { input: 'b', pop: 'A', push: '', pop2: '', push2: 'B' },
    ]);
  });

  it('allows one input symbol to take different stack actions', () => {
    expect(twoStackTriples('a,Z>AZ|ε>ε; a,Z>ε|ε>ε')).toHaveLength(2);
  });

  it('rejects an entry repeated exactly', () => {
    expect(twoStackError('a,Z>A|ε>ε; a,Z>A|ε>ε')).toContain('duas vezes');
  });

  it('rejects an entry with no bar', () => {
    expect(twoStackError('a,Z>AZ')).toContain('barra');
  });

  it('rejects more than one bar, since there are only two stacks', () => {
    expect(twoStackError('a,Z>A|Z>B|Z>C')).toContain('duas pilhas');
  });

  it('rejects a side with no arrow', () => {
    expect(twoStackError('a,Z,AZ|Z>B')).toContain('seta');
    expect(twoStackError('a,Z>AZ|Z,B')).toContain('seta');
  });

  it('rejects a read symbol after the bar, which belongs before the first arrow', () => {
    expect(twoStackError('a,Z>AZ|b,Z>B')).toContain('depois da barra');
  });

  it('rejects a first side missing the popped symbol', () => {
    expect(twoStackError('a>AZ|Z>B')).toContain('duas partes');
  });

  it('rejects an empty part instead of guessing it meant epsilon', () => {
    expect(twoStackError('a,>A|Z>B')).toContain('vazia');
    expect(twoStackError('a,Z>A|>B')).toContain('vazia');
    expect(twoStackError(',Z>A|Z>B')).toContain('vazia');
  });

  it('rejects a pop of more than one symbol on either stack', () => {
    expect(twoStackError('a,AB>C|ε>ε')).toContain('um símbolo por vez');
    expect(twoStackError('a,ε>ε|AB>C')).toContain('um símbolo por vez');
  });

  it('reads an empty label as no transitions at all', () => {
    expect(twoStackTriples('')).toEqual([]);
  });
});

describe('formatTwoStackTransitions', () => {
  it('round-trips what was parsed with canonical glyphs and spacing', () => {
    expect(formatTwoStackTransitions(twoStackTriples('a,Z->AZ|eps>B; b,A>ε|B>ε'))).toBe(
      `a, Z→AZ | ${EPSILON}→B; b, A→${EPSILON} | B→${EPSILON}`,
    );
  });

  it('renders absent operations on both stacks as epsilon', () => {
    expect(formatTwoStackTransitions([{ input: 'a', pop: '', push: '', pop2: '', push2: '' }])).toBe(
      `a, ${EPSILON}→${EPSILON} | ${EPSILON}→${EPSILON}`,
    );
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run src/engine/transitionSyntax.test.ts`
Expected: FAIL com `parseTwoStackTransitions is not a function` (ou export ausente).

- [ ] **Step 3: Implementar**

No fim de `src/engine/transitionSyntax.ts`:

```ts
export interface TwoStackTriple {
  input: string;
  /** Symbol popped off the first stack. '' means no pop. */
  pop: string;
  /** Symbols pushed onto the first stack, top-of-stack first. '' means nothing pushed. */
  push: string;
  /** Symbol popped off the second stack. '' means no pop. */
  pop2: string;
  /** Symbols pushed onto the second stack, top-of-stack first. '' means nothing pushed. */
  push2: string;
}

/** What separates the two stacks' operations on a label. */
const STACK_SEPARATOR = '|';

export const TWO_STACK_SYNTAX_PLACEHOLDER = 'lê, desempilha>empilha | desempilha>empilha';

/** The editable text for a group of transitions: `a, Z→AZ | ε→B; b, A→ε | B→ε`. */
export function formatTwoStackTransitions(transitions: TwoStackTriple[]): string {
  return transitions
    .map(
      (t) =>
        `${t.input || EPSILON}, ${t.pop || EPSILON}${STACK_ARROW}${t.push || EPSILON}` +
        ` ${STACK_SEPARATOR} ${t.pop2 || EPSILON}${STACK_ARROW}${t.push2 || EPSILON}`,
    )
    .join('; ');
}

export type TwoStackParseResult = { ok: true; triples: TwoStackTriple[] } | { ok: false; error: string };

/**
 * Parses a two-stack label: the PDA syntax for the first stack, a bar, then
 * only the operation on the second stack. The symbol read appears once, before
 * the first arrow. Like the PDA, only an exactly repeated entry is rejected.
 */
export function parseTwoStackTransitions(text: string): TwoStackParseResult {
  const entries = text
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean);

  const triples: TwoStackTriple[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    const stacks = entry.split(STACK_SEPARATOR);
    if (stacks.length < 2) {
      return {
        ok: false,
        error: `Em "${entry}" faltou a barra separando as duas pilhas: ${TWO_STACK_SYNTAX_PLACEHOLDER}.`,
      };
    }
    if (stacks.length > 2) {
      return { ok: false, error: `Em "${entry}" há mais de uma barra, mas só há duas pilhas.` };
    }

    const first = splitArrow(stacks[0].trim(), entry, TWO_STACK_SYNTAX_PLACEHOLDER);
    if (!first.ok) return first;

    const readParts = first.left.split(',').map((part) => part.trim());
    if (readParts.length !== 2) {
      return {
        ok: false,
        error: `Em "${entry}", antes da primeira seta vêm duas partes separadas por vírgula: o símbolo lido e o desempilhado da pilha 1.`,
      };
    }

    const input = normalizeSymbol(readParts[0]);
    if (!input) return emptyPartError(entry);

    const op1 = parseStackOp(readParts[1], first.right, entry);
    if (!op1.ok) return op1;

    const second = splitArrow(stacks[1].trim(), entry, TWO_STACK_SYNTAX_PLACEHOLDER);
    if (!second.ok) return second;
    if (second.left.includes(',')) {
      return {
        ok: false,
        error: `Em "${entry}", depois da barra vem só a operação da pilha 2: desempilha>empilha.`,
      };
    }

    const op2 = parseStackOp(second.left, second.right, entry);
    if (!op2.ok) return op2;

    const triple: TwoStackTriple = { input, pop: op1.pop, push: op1.push, pop2: op2.pop, push2: op2.push };

    const key = `${triple.input}|${triple.pop}|${triple.push}|${triple.pop2}|${triple.push2}`;
    if (seen.has(key)) {
      return { ok: false, error: `"${entry}" aparece duas vezes aqui.` };
    }
    seen.add(key);

    triples.push(triple);
  }

  return { ok: true, triples };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm vitest run src/engine/transitionSyntax.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/transitionSyntax.ts src/engine/transitionSyntax.test.ts
git commit -m "feat(engine): interpretar rótulos de transição de duas pilhas" -m "A barra separa as operações das duas pilhas, e o símbolo lido aparece uma só vez, antes da primeira seta. Cada lado reaproveita a operação de pilha do PDA, então as mensagens de erro são as mesmas."
```

---

### Task 4: Simular a segunda pilha

**Files:**
- Modify: `src/engine/simulate.ts`
- Test: `src/engine/simulate.test.ts`

**Interfaces:**
- Consumes: `Transition.pop2/push2` (Task 1).
- Produces: `SimulationBranch.stack2?: string[]` (só em 2PDA); chave de ramo `stateId::stack1::stack2` para 2PDA, inalterada para os demais.

- [ ] **Step 1: Escrever os testes que falham**

No fim de `src/engine/simulate.test.ts`, antes de `describe('simulate - edge cases'`:

```ts
/**
 * aⁿbⁿcⁿ (n ≥ 0): the a's pile up on stack 1, each b moves one over to stack 2,
 * each c takes one off stack 2. Not context-free, so a single stack couldn't do it.
 */
const anbncnTwoStack: Automaton = {
  schemaVersion: 1,
  id: '2pda-1',
  name: 'a^n b^n c^n',
  kind: '2PDA',
  alphabet: ['a', 'b', 'c'],
  stackAlphabet: ['Z', 'A', 'B'],
  startStateId: 'qs',
  states: [
    { id: 'qs', label: 'qs', position: pos(0, 0), isStart: true, isAccept: false },
    { id: 'q0', label: 'q0', position: pos(100, 0), isStart: false, isAccept: false },
    { id: 'q1', label: 'q1', position: pos(200, 0), isStart: false, isAccept: false },
    { id: 'q2', label: 'q2', position: pos(300, 0), isStart: false, isAccept: false },
    { id: 'qf', label: 'qf', position: pos(400, 0), isStart: false, isAccept: true },
  ],
  transitions: [
    { id: 's1', from: 'qs', to: 'q0', input: EPSILON, pop: '', push: 'Z', pop2: '', push2: 'Z' },
    { id: 's2', from: 'q0', to: 'q0', input: 'a', pop: '', push: 'A', pop2: '', push2: '' },
    { id: 's3', from: 'q0', to: 'q1', input: EPSILON, pop: '', push: '', pop2: '', push2: '' },
    { id: 's4', from: 'q1', to: 'q1', input: 'b', pop: 'A', push: '', pop2: '', push2: 'B' },
    { id: 's5', from: 'q1', to: 'q2', input: EPSILON, pop: '', push: '', pop2: '', push2: '' },
    { id: 's6', from: 'q2', to: 'q2', input: 'c', pop: '', push: '', pop2: 'B', push2: '' },
    { id: 's7', from: 'q2', to: 'qf', input: EPSILON, pop: 'Z', push: '', pop2: 'Z', push2: '' },
  ],
};

/** One move that pops from both stacks; `setup` decides what each stack starts with. */
function bothStacksMachine(setup: { push: string; push2: string }): Automaton {
  return {
    schemaVersion: 1,
    id: '2pda-2',
    name: 'ambas',
    kind: '2PDA',
    alphabet: ['a'],
    stackAlphabet: ['A', 'B'],
    startStateId: 'qs',
    states: [
      { id: 'qs', label: 'qs', position: pos(0, 0), isStart: true, isAccept: false },
      { id: 'q0', label: 'q0', position: pos(100, 0), isStart: false, isAccept: false },
      { id: 'qf', label: 'qf', position: pos(200, 0), isStart: false, isAccept: true },
    ],
    transitions: [
      { id: 'b1', from: 'qs', to: 'q0', input: EPSILON, pop: '', push: setup.push, pop2: '', push2: setup.push2 },
      { id: 'b2', from: 'q0', to: 'qf', input: 'a', pop: 'A', push: '', pop2: 'B', push2: '' },
    ],
  };
}

describe('simulate - 2PDA (a^n b^n c^n)', () => {
  it('accepts the empty string and balanced strings', () => {
    expect(simulate(anbncnTwoStack, '').accepted).toBe(true);
    expect(simulate(anbncnTwoStack, 'abc').accepted).toBe(true);
    expect(simulate(anbncnTwoStack, 'aabbcc').accepted).toBe(true);
    expect(simulate(anbncnTwoStack, 'aaabbbccc').accepted).toBe(true);
  });

  it('rejects strings a single stack would let through', () => {
    expect(simulate(anbncnTwoStack, 'aabbc').accepted).toBe(false);
    expect(simulate(anbncnTwoStack, 'abcc').accepted).toBe(false);
    expect(simulate(anbncnTwoStack, 'aabbbccc').accepted).toBe(false);
  });

  it('rejects out-of-order strings', () => {
    expect(simulate(anbncnTwoStack, 'acb').accepted).toBe(false);
    expect(simulate(anbncnTwoStack, 'abbc').accepted).toBe(false);
  });

  it('carries both stacks on every branch and keys the branch by both', () => {
    const { steps } = simulate(anbncnTwoStack, 'ab');
    const q1 = steps[2].branches.find((b) => b.stateId === 'q1')!;
    expect(q1.stack).toEqual(['Z']);
    expect(q1.stack2).toEqual(['B', 'Z']);
    expect(q1.key).toBe('q1::Z::BZ');
  });
});

describe('simulate - 2PDA stack matching', () => {
  it('fires only when both pops match', () => {
    expect(simulate(bothStacksMachine({ push: 'A', push2: 'B' }), 'a').accepted).toBe(true);
  });

  it('dies when only the first stack matches, and reports the branch as dead', () => {
    const { accepted, steps } = simulate(bothStacksMachine({ push: 'A', push2: '' }), 'a');
    expect(accepted).toBe(false);
    expect(steps[1].branches).toEqual([]);
    expect(steps[1].deadBranches?.map((b) => b.stateId)).toEqual(['qs', 'q0']);
  });

  it('dies when only the second stack matches', () => {
    expect(simulate(bothStacksMachine({ push: '', push2: 'B' }), 'a').accepted).toBe(false);
  });

  it('keeps configurations apart when only the second stack differs', () => {
    const forked: Automaton = {
      ...bothStacksMachine({ push: '', push2: '' }),
      transitions: [
        { id: 'f1', from: 'qs', to: 'q0', input: EPSILON, pop: '', push: '', pop2: '', push2: 'X' },
        { id: 'f2', from: 'qs', to: 'q0', input: EPSILON, pop: '', push: '', pop2: '', push2: 'Y' },
      ],
    };
    const { steps } = simulate(forked, '');
    expect(steps[0].branches.map((b) => b.key)).toEqual(['qs::::', 'q0::::X', 'q0::::Y']);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run src/engine/simulate.test.ts`
Expected: FAIL. O motor ignora `pop2`/`push2`, então `aabbc` é aceito, `stack2` é `undefined` e as chaves não têm a terceira parte.

- [ ] **Step 3: Implementar**

Em `src/engine/simulate.ts`:

Import, linha 1:

```ts
import type { Automaton, Transition } from '../types/automaton';
```

Em `SimulationBranch`, após `stack: string[];`:

```ts
  /** 2PDA only: the second stack, top at stack2[0]. */
  stack2?: string[];
```

Substituir `branchKey` e acrescentar os dois helpers logo após `applyStackOp`:

```ts
function branchKey(stateId: string, stack: string[], stack2?: string[]): string {
  const base = `${stateId}::${stack.join('')}`;
  return stack2 ? `${base}::${stack2.join('')}` : base;
}
```

```ts
/** Whether every stack the transition pops from has that symbol on top. */
function stackOpsMatch(automaton: Automaton, t: Transition, branch: SimulationBranch): boolean {
  if (automaton.kind === 'PDA') return popMatches(t.pop, branch.stack);
  if (automaton.kind === '2PDA') return popMatches(t.pop, branch.stack) && popMatches(t.pop2, branch.stack2 ?? []);
  return true;
}

/** The stacks the transition leaves behind; untouched on automata without one. */
function applyStackOps(
  automaton: Automaton,
  t: Transition,
  branch: SimulationBranch,
): Pick<SimulationBranch, 'stack' | 'stack2'> {
  if (automaton.kind === 'PDA') return { stack: applyStackOp(branch.stack, t.pop, t.push) };
  if (automaton.kind === '2PDA') {
    return {
      stack: applyStackOp(branch.stack, t.pop, t.push),
      stack2: applyStackOp(branch.stack2 ?? [], t.pop2, t.push2),
    };
  }
  return { stack: branch.stack };
}
```

Em `epsilonClosure`, o corpo do `for (const t of automaton.transitions)` vira:

```ts
      if (t.from !== current.stateId || t.input !== EPSILON) continue;
      if (!stackOpsMatch(automaton, t, current)) continue;
      const stacks = applyStackOps(automaton, t, current);
      const key = branchKey(t.to, stacks.stack, stacks.stack2);
      if (visited.has(key)) continue;
      const next: SimulationBranch = {
        key,
        stateId: t.to,
        ...stacks,
        viaTransitionIds: [...current.viaTransitionIds, t.id],
        parentKey: current.parentKey,
      };
      visited.set(key, next);
      queue.push(next);
```

Em `simulate`, o ramo inicial:

```ts
  const emptyStacks: Pick<SimulationBranch, 'stack' | 'stack2'> =
    automaton.kind === '2PDA' ? { stack: [], stack2: [] } : { stack: [] };
  const initial: SimulationBranch = {
    key: branchKey(automaton.startStateId, emptyStacks.stack, emptyStacks.stack2),
    stateId: automaton.startStateId,
    ...emptyStacks,
    viaTransitionIds: [],
  };
```

E o laço de consumo:

```ts
      for (const t of automaton.transitions) {
        if (t.from !== branch.stateId || t.input !== symbol) continue;
        if (!stackOpsMatch(automaton, t, branch)) continue;
        const stacks = applyStackOps(automaton, t, branch);
        consumed.push({
          key: branchKey(t.to, stacks.stack, stacks.stack2),
          stateId: t.to,
          ...stacks,
          viaTransitionIds: [t.id],
          parentKey: branch.key,
        });
      }
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm vitest run src/engine/simulate.test.ts src/components/Canvas/StackStrip.test.tsx`
Expected: PASS. As chaves de PDA (`q1::aZ`) não mudam porque `stack2` é `undefined` fora do 2PDA.

- [ ] **Step 5: Commit**

```bash
git add src/engine/simulate.ts src/engine/simulate.test.ts
git commit -m "feat(engine): simular autômatos de duas pilhas" -m "A transição só dispara quando consegue desempilhar das duas pilhas, e a chave da configuração inclui a segunda, para que ramos que diferem só nela não se fundam. O teste usa aⁿbⁿcⁿ, que uma pilha só não reconhece."
```

---

### Task 5: Reconciliar transições a partir do rótulo de duas pilhas

**Files:**
- Modify: `src/engine/labelEditing.ts`
- Test: `src/engine/labelEditing.test.ts`

**Interfaces:**
- Consumes: `parseTwoStackTransitions` (Task 3).
- Produces: `planTwoStackEdit(automaton, from, to, text): TransitionEdit | null`.

- [ ] **Step 1: Escrever os testes que falham**

Em `src/engine/labelEditing.test.ts`, trocar o import e a assinatura de `withStates`:

```ts
import { planPdaEdit, planSymbolEdit, planTuringEdit, planTwoStackEdit } from './labelEditing';
import { BLANK, EPSILON, createEmptyAutomaton, type Automaton, type AutomatonKind } from '../types/automaton';

function withStates(kind: AutomatonKind): Automaton {
```

No fim do arquivo:

```ts
describe('planTwoStackEdit', () => {
  it('adds a typed entry and declares the symbols of both stacks once', () => {
    const edit = planTwoStackEdit(withStates('2PDA'), 'q0', 'q1', 'a, Z>AZ | Z>BZ')!;
    expect(edit.add).toEqual([{ from: 'q0', to: 'q1', input: 'a', pop: 'Z', push: 'AZ', pop2: 'Z', push2: 'BZ' }]);
    expect(edit.newInputSymbols).toEqual(['a']);
    expect(edit.newStackSymbols).toEqual(['Z', 'A', 'B']);
  });

  it('never declares epsilon as a symbol of either alphabet', () => {
    const edit = planTwoStackEdit(withStates('2PDA'), 'q0', 'q1', 'eps, ε>ε | ε>ε')!;
    expect(edit.newInputSymbols).toEqual([]);
    expect(edit.newStackSymbols).toEqual([]);
    expect(edit.add).toEqual([{ from: 'q0', to: 'q1', input: EPSILON, pop: '', push: '', pop2: '', push2: '' }]);
  });

  it('only reports symbols the alphabets are missing', () => {
    const automaton = { ...withStates('2PDA'), alphabet: ['a'], stackAlphabet: ['Z'] };
    const edit = planTwoStackEdit(automaton, 'q0', 'q1', 'a, Z>AZ | ε>B')!;
    expect(edit.newInputSymbols).toEqual([]);
    expect(edit.newStackSymbols).toEqual(['A', 'B']);
  });

  it('leaves an unchanged entry alone', () => {
    const automaton: Automaton = {
      ...withStates('2PDA'),
      transitions: [{ id: 't1', from: 'q0', to: 'q1', input: 'a', pop: 'Z', push: 'AZ', pop2: '', push2: 'B' }],
    };
    const edit = planTwoStackEdit(automaton, 'q0', 'q1', 'a, Z>AZ | ε>B')!;
    expect(edit.add).toEqual([]);
    expect(edit.remove).toEqual([]);
    expect(edit.update).toEqual([]);
  });

  it('replaces the transition when only the second stack operation changes', () => {
    const automaton: Automaton = {
      ...withStates('2PDA'),
      transitions: [{ id: 't1', from: 'q0', to: 'q1', input: 'a', pop: 'Z', push: 'AZ', pop2: '', push2: 'B' }],
    };
    const edit = planTwoStackEdit(automaton, 'q0', 'q1', 'a, Z>AZ | B>ε')!;
    expect(edit.remove).toEqual(['t1']);
    expect(edit.add).toEqual([{ from: 'q0', to: 'q1', input: 'a', pop: 'Z', push: 'AZ', pop2: 'B', push2: '' }]);
  });

  it('removes an entry dropped from the label', () => {
    const automaton: Automaton = {
      ...withStates('2PDA'),
      transitions: [
        { id: 't1', from: 'q0', to: 'q1', input: 'a', pop: 'Z', push: 'AZ', pop2: '', push2: '' },
        { id: 't2', from: 'q0', to: 'q1', input: 'b', pop: 'A', push: '', pop2: '', push2: 'B' },
      ],
    };
    const edit = planTwoStackEdit(automaton, 'q0', 'q1', 'a, Z>AZ | ε>ε')!;
    expect(edit.remove).toEqual(['t2']);
    expect(edit.add).toEqual([]);
  });

  it('changes nothing at all when the text does not parse', () => {
    expect(planTwoStackEdit(withStates('2PDA'), 'q0', 'q1', 'a, Z>AZ')).toBeNull();
  });

  it('clears every transition when the label is emptied', () => {
    const automaton: Automaton = {
      ...withStates('2PDA'),
      transitions: [{ id: 't1', from: 'q0', to: 'q1', input: 'a', pop: 'Z', push: 'AZ', pop2: '', push2: '' }],
    };
    expect(planTwoStackEdit(automaton, 'q0', 'q1', '')!.remove).toEqual(['t1']);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run src/engine/labelEditing.test.ts`
Expected: FAIL com `planTwoStackEdit is not a function`.

- [ ] **Step 3: Implementar**

Em `src/engine/labelEditing.ts`:

Import:

```ts
import { normalizeSymbol, parsePdaTransitions, parseTuringTransitions, parseTwoStackTransitions } from './transitionSyntax';
```

Comentário de `newStackSymbols` em `TransitionEdit`:

```ts
  /** PDA/2PDA only: symbols popped or pushed that the shared stack alphabet doesn't declare yet. */
  newStackSymbols: string[];
```

Antes de `planPdaEdit`, dois helpers:

```ts
function undeclaredInputSymbols(automaton: Automaton, inputs: string[]): string[] {
  return [...new Set(inputs)].filter((s) => s !== EPSILON && !automaton.alphabet.includes(s));
}

/**
 * Every character pushed is one stack symbol, matching how the engine applies
 * a push (`push.split('')`). Shared by the one- and two-stack planners since
 * both feed the same stack alphabet.
 */
function undeclaredStackSymbols(automaton: Automaton, ops: { pop: string; push: string }[]): string[] {
  const stackAlphabet = automaton.stackAlphabet ?? [];
  const used = new Set(ops.flatMap((op) => [op.pop, ...op.push.split('')]).filter(Boolean));
  return [...used].filter((s) => !stackAlphabet.includes(s));
}
```

Em `planPdaEdit`, substituir o bloco que calcula `stackAlphabet`, `usedStackSymbols`, `usedInputSymbols` e o `return` por:

```ts
  return {
    remove: existing
      .filter((t) => !keptKeys.has(keyOf(t.input, t.pop ?? '', t.push ?? '')))
      .map((t) => t.id),
    update: [],
    add: parsed.triples
      .filter((t) => !existingKeys.has(keyOf(t.input, t.pop, t.push)))
      .map(({ input, pop, push }) => ({ from, to, input, pop, push })),
    newInputSymbols: undeclaredInputSymbols(automaton, parsed.triples.map((t) => t.input)),
    newTapeSymbols: [],
    newStackSymbols: undeclaredStackSymbols(automaton, parsed.triples),
  };
```

No fim do arquivo:

```ts
/**
 * 2PDA: the label is a list of `read, pop→push | pop→push` entries. Reconciled
 * by the whole entry, like the PDA: editing any of the four stack parts
 * replaces the transition rather than patching it.
 */
export function planTwoStackEdit(
  automaton: Automaton,
  from: string,
  to: string,
  text: string,
): TransitionEdit | null {
  const parsed = parseTwoStackTransitions(text);
  if (!parsed.ok) return null;

  const existing = automaton.transitions.filter((t) => t.from === from && t.to === to);
  const keyOf = (t: Pick<Transition, 'input' | 'pop' | 'push' | 'pop2' | 'push2'>) =>
    `${t.input}|${t.pop ?? ''}|${t.push ?? ''}|${t.pop2 ?? ''}|${t.push2 ?? ''}`;
  const existingKeys = new Set(existing.map(keyOf));
  const keptKeys = new Set(parsed.triples.map(keyOf));

  return {
    remove: existing.filter((t) => !keptKeys.has(keyOf(t))).map((t) => t.id),
    update: [],
    add: parsed.triples
      .filter((t) => !existingKeys.has(keyOf(t)))
      .map(({ input, pop, push, pop2, push2 }) => ({ from, to, input, pop, push, pop2, push2 })),
    newInputSymbols: undeclaredInputSymbols(automaton, parsed.triples.map((t) => t.input)),
    newTapeSymbols: [],
    newStackSymbols: undeclaredStackSymbols(
      automaton,
      parsed.triples.flatMap((t) => [
        { pop: t.pop, push: t.push },
        { pop: t.pop2, push: t.push2 },
      ]),
    ),
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm vitest run src/engine/labelEditing.test.ts`
Expected: PASS, incluindo os testes de `planPdaEdit` sem alteração.

- [ ] **Step 5: Commit**

```bash
git add src/engine/labelEditing.ts src/engine/labelEditing.test.ts
git commit -m "feat(engine): planejar a edição de rótulos de duas pilhas" -m "A reconciliação é pela entrada inteira, como no PDA, porque o símbolo lido não identifica uma transição não-determinística. O alfabeto de pilha é um só, então os símbolos das duas pilhas caem no mesmo conjunto."
```

---

### Task 6: Criar e identificar um AP2 na interface

**Files:**
- Modify: `src/components/TabBar/TabBar.tsx:6`
- Modify: `src/components/Toolbar/Toolbar.tsx:104`
- Test: `src/components/Toolbar/Toolbar.test.tsx`

**Interfaces:**
- Consumes: `hasStack` (Task 1).

- [ ] **Step 1: Escrever o teste que falha**

Em `src/components/Toolbar/Toolbar.test.tsx`, dentro do `describe`:

```ts
  it('shows the stack alphabet field for a two-stack automaton and resyncs it', () => {
    act(() => useAutomatonStore.getState().openTab(createEmptyAutomaton('2PDA')));
    render(<Toolbar />);
    const field = screen.getByLabelText('Alfabeto da pilha', { selector: 'input' }) as HTMLInputElement;
    expect(field.value).toBe('');

    act(() => useAutomatonStore.getState().setStackAlphabet(['A', 'Z']));
    expect(field.value).toBe('A, Z');
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run src/components/Toolbar/Toolbar.test.tsx`
Expected: FAIL com `Unable to find a label with the text of: Alfabeto da pilha`.

- [ ] **Step 3: Implementar**

`src/components/TabBar/TabBar.tsx`, linha 6:

```ts
const KIND_BADGE: Record<string, string> = { DFA: 'AFD', NFA: 'AFN', PDA: 'PDA', '2PDA': 'AP2', TM: 'MT' };
```

`src/components/Toolbar/Toolbar.tsx`: acrescentar `hasStack` ao import de `../../types/automaton` e trocar a condição do campo:

```tsx
        {hasStack(automaton.kind) && (
          <label className="toolbar__field">
            <span>Alfabeto da pilha</span>
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm vitest run src/components/Toolbar/Toolbar.test.tsx && pnpm exec tsc -b`
Expected: PASS e sem erros de tipo.

- [ ] **Step 5: Commit**

```bash
git add src/components/TabBar/TabBar.tsx src/components/Toolbar/Toolbar.tsx src/components/Toolbar/Toolbar.test.tsx
git commit -m "feat(ui): identificar autômatos de duas pilhas na aba e na toolbar" -m "O AP2 ganha badge próprio e usa o mesmo campo de alfabeto de pilha do PDA, já que o alfabeto é compartilhado pelas duas pilhas."
```

---

### Task 7: Editar rótulos de duas pilhas no canvas

**Files:**
- Modify: `src/components/Canvas/Canvas.tsx:26-36,173-240`

**Interfaces:**
- Consumes: `TWO_STACK_SYNTAX_PLACEHOLDER`, `parseTwoStackTransitions`, `formatTwoStackTransitions` (Task 3); `planTwoStackEdit` (Task 5).

O canvas não tem testes de componente; a verificação é por tipos, lint e uso manual.

- [ ] **Step 1: Importar**

Em `src/components/Canvas/Canvas.tsx`, os dois imports do motor viram:

```ts
import {
  PDA_SYNTAX_PLACEHOLDER,
  TURING_SYNTAX_PLACEHOLDER,
  TWO_STACK_SYNTAX_PLACEHOLDER,
  formatPdaTransitions,
  formatTuringTransitions,
  formatTwoStackTransitions,
  parsePdaTransitions,
  parseTuringTransitions,
  parseTwoStackTransitions,
} from '../../engine/transitionSyntax';
import { planPdaEdit, planSymbolEdit, planTuringEdit, planTwoStackEdit, type TransitionEdit } from '../../engine/labelEditing';
```

- [ ] **Step 2: Compartilhar o commit entre PDA e 2PDA**

Substituir o `handleCommitPda` inteiro por:

```ts
  /** Applies an edit from a stack automaton's label and declares the symbols it introduced. */
  const applyStackEdit = useCallback(
    (edit: TransitionEdit | null) => {
      if (!edit) return;
      applyTransitionEdit(edit);
      if (edit.newStackSymbols.length > 0) {
        setStackAlphabet([...(automaton.stackAlphabet ?? []), ...edit.newStackSymbols].sort());
      }
      if (edit.newInputSymbols.length > 0) {
        setAlphabet([...automaton.alphabet, ...edit.newInputSymbols].sort());
      }
    },
    [automaton, applyTransitionEdit, setAlphabet, setStackAlphabet],
  );

  const handleCommitPda = useCallback(
    (from: string, to: string, text: string) => applyStackEdit(planPdaEdit(automaton, from, to, text)),
    [automaton, applyStackEdit],
  );

  const handleCommitTwoStack = useCallback(
    (from: string, to: string, text: string) => applyStackEdit(planTwoStackEdit(automaton, from, to, text)),
    [automaton, applyStackEdit],
  );
```

Logo após `validatePdaText`:

```ts
  const validateTwoStackText = useCallback((text: string) => {
    const parsed = parseTwoStackTransitions(text);
    return parsed.ok ? null : parsed.error;
  }, []);
```

- [ ] **Step 3: Acrescentar o ramo no `labelEditor`**

Dentro do `useMemo` de `labelEditor`, após o bloco `if (automaton.kind === 'PDA') {...}`:

```ts
    if (automaton.kind === '2PDA') {
      return {
        placeholder: TWO_STACK_SYNTAX_PLACEHOLDER,
        validateText: validateTwoStackText,
        format: (transitions: Transition[]) =>
          formatTwoStackTransitions(
            transitions.map((t) => ({
              input: t.input,
              pop: t.pop ?? '',
              push: t.push ?? '',
              pop2: t.pop2 ?? '',
              push2: t.push2 ?? '',
            })),
          ),
        commit: handleCommitTwoStack,
      };
    }
```

E a lista de dependências do `useMemo`:

```ts
  }, [
    automaton.kind,
    validateTuringText,
    validatePdaText,
    validateTwoStackText,
    handleCommitTuring,
    handleCommitPda,
    handleCommitTwoStack,
    handleCommitSymbols,
  ]);
```

Atualizar o comentário acima do `useMemo` para citar o quarto formato:

```ts
  /**
   * How a transition label is typed and read back, which is the only thing that
   * differs between kinds: a symbol list, a read/write/move triple, a
   * read/pop/push one, or the same with a second pop/push after a bar.
   */
```

- [ ] **Step 4: Verificar tipos, lint e suite**

Run: `pnpm exec tsc -b && pnpm lint && pnpm test`
Expected: sem erros, todos os testes passando.

- [ ] **Step 5: Verificar manualmente**

Run: `pnpm dev`, abrir o app, criar "AP2", adicionar dois estados, arrastar uma transição entre eles e digitar `a, Z>AZ | eps>B`. Esperado: o rótulo desenha `a, Z→AZ | ε→B`, o campo "Alfabeto da pilha" mostra `A, B, Z` e o campo "Alfabeto" mostra `a`. Digitar `a, Z>AZ` (sem barra) mostra o erro de barra e não altera nada.

- [ ] **Step 6: Commit**

```bash
git add src/components/Canvas/Canvas.tsx
git commit -m "feat(canvas): editar transições de duas pilhas no rótulo" -m "O tratamento de símbolos novos depois de um commit era o mesmo para PDA e AP2, então passou a ser uma função só, e cada tipo apenas escolhe o planejador."
```

---

### Task 8: Tabela de transições e chips do painel de simulação

**Files:**
- Modify: `src/components/SidePanel/TransitionList.tsx`
- Modify: `src/components/SidePanel/SimulatePanel.tsx:157-159`

**Interfaces:**
- Consumes: `hasStack` (Task 1), `SimulationBranch.stack2` (Task 4).

Esses componentes não têm testes de componente hoje; a verificação é por tipos e uso manual.

- [ ] **Step 1: Tabela de transições**

Em `src/components/SidePanel/TransitionList.tsx`:

Import:

```ts
import { EPSILON, TAPE_MOVE_LABELS, hasStack, type TapeMove } from '../../types/automaton';
```

Trocar `const isPda = automaton.kind === 'PDA';` por:

```ts
  const hasStacks = hasStack(automaton.kind);
  const isTwoStack = automaton.kind === '2PDA';
```

Estados de rascunho, após `draftPush`:

```ts
  const [draftPop2, setDraftPop2] = useState('');
  const [draftPush2, setDraftPush2] = useState('');
```

Em `handleAdd`:

```ts
    addTransition({
      from: draftFrom,
      to: draftTo,
      input: draftInput,
      ...(hasStacks ? { pop: draftPop, push: draftPush } : {}),
      ...(isTwoStack ? { pop2: draftPop2, push2: draftPush2 } : {}),
      ...(isTm ? { write: draftWrite || draftInput, move: draftMove } : {}),
    });
    setDraftInput('');
    setDraftPop('');
    setDraftPush('');
    setDraftPop2('');
    setDraftPush2('');
    setDraftWrite('');
```

Cabeçalho:

```tsx
          {hasStacks && <th>{isTwoStack ? 'Desempilha 1' : 'Pop'}</th>}
          {hasStacks && <th>{isTwoStack ? 'Empilha 1' : 'Push'}</th>}
          {isTwoStack && <th>Desempilha 2</th>}
          {isTwoStack && <th>Empilha 2</th>}
```

Nas linhas existentes, trocar os dois `{isPda && (...)}` por `{hasStacks && (...)}` e acrescentar após o de `push`:

```tsx
            {isTwoStack && (
              <td>
                <input
                  className="mono data-table__input data-table__input--narrow"
                  value={t.pop2 ?? ''}
                  placeholder="ε"
                  onChange={(e) => updateTransition(t.id, { pop2: e.target.value })}
                />
              </td>
            )}
            {isTwoStack && (
              <td>
                <input
                  className="mono data-table__input data-table__input--narrow"
                  value={t.push2 ?? ''}
                  placeholder="ε"
                  onChange={(e) => updateTransition(t.id, { push2: e.target.value })}
                />
              </td>
            )}
```

Na linha de nova transição, idem: `{isPda && ...}` vira `{hasStacks && ...}` e após o campo de `draftPush`:

```tsx
          {isTwoStack && (
            <td>
              <input
                className="mono data-table__input data-table__input--narrow"
                value={draftPop2}
                placeholder="ε"
                onChange={(e) => setDraftPop2(e.target.value)}
              />
            </td>
          )}
          {isTwoStack && (
            <td>
              <input
                className="mono data-table__input data-table__input--narrow"
                value={draftPush2}
                placeholder="ε"
                onChange={(e) => setDraftPush2(e.target.value)}
              />
            </td>
          )}
```

- [ ] **Step 2: Chips do painel**

Em `src/components/SidePanel/SimulatePanel.tsx`, acrescentar `hasStack` ao import de `../../types/automaton` e trocar o bloco do chip:

```tsx
                    {hasStack(automaton.kind) && (
                      <span className="branch-chip__stack mono">[{b.stack.join(' ') || 'vazia'}]</span>
                    )}
                    {automaton.kind === '2PDA' && (
                      <span className="branch-chip__stack mono">[{(b.stack2 ?? []).join(' ') || 'vazia'}]</span>
                    )}
```

- [ ] **Step 3: Verificar tipos, lint e suite**

Run: `pnpm exec tsc -b && pnpm lint && pnpm test`
Expected: sem erros.

- [ ] **Step 4: Verificar manualmente**

Run: `pnpm dev`. Num AP2 com a transição `a, eps>A | eps>B` entre dois estados, abrir a aba de transições: a linha mostra vazio, `A`, vazio, `B` nas quatro colunas de pilha. Editar a coluna "Empilha 2" para `BB` atualiza o rótulo no canvas para `a, ε→A | ε→BB`. No painel de simulação, rodar com entrada `a`: o chip do estado de destino mostra `[A] [B B]`.

- [ ] **Step 5: Commit**

```bash
git add src/components/SidePanel/TransitionList.tsx src/components/SidePanel/SimulatePanel.tsx
git commit -m "feat(panel): mostrar a segunda pilha na tabela e nos ramos" -m "Sem as colunas da pilha 2, a tabela era a única tela em que uma transição de AP2 aparecia incompleta, e o chip de ramo escondia metade da configuração."
```

---

### Task 9: Duas pilhas por cartão na faixa de pilhas

**Files:**
- Modify: `src/components/Canvas/StackStrip.tsx`
- Modify: `src/components/Canvas/StackStrip.css`
- Test: `src/components/Canvas/StackStrip.test.tsx`

**Interfaces:**
- Consumes: `hasStack` (Task 1), `SimulationBranch.stack2` (Task 4), `formatTransitionLabel` (Task 1).

- [ ] **Step 1: Escrever os testes que falham**

Em `src/components/Canvas/StackStrip.test.tsx`, após a função `palindromes()`:

```ts
/** aⁿbⁿcⁿ on two stacks: a's pile on stack 1, each b moves one to stack 2, each c takes one off. */
function anbncn(): Automaton {
  return {
    ...createEmptyAutomaton('2PDA'),
    alphabet: ['a', 'b', 'c'],
    stackAlphabet: ['Z', 'A', 'B'],
    startStateId: 'qs',
    states: [
      { id: 'qs', label: 'qs', position: { x: 0, y: 0 }, isStart: true, isAccept: false },
      { id: 'q0', label: 'q0', position: { x: 100, y: 0 }, isStart: false, isAccept: false },
      { id: 'q1', label: 'q1', position: { x: 200, y: 0 }, isStart: false, isAccept: false },
      { id: 'q2', label: 'q2', position: { x: 300, y: 0 }, isStart: false, isAccept: false },
      { id: 'qf', label: 'qf', position: { x: 400, y: 0 }, isStart: false, isAccept: true },
    ],
    transitions: [
      { id: 's1', from: 'qs', to: 'q0', input: EPSILON, pop: '', push: 'Z', pop2: '', push2: 'Z' },
      { id: 's2', from: 'q0', to: 'q0', input: 'a', pop: '', push: 'A', pop2: '', push2: '' },
      { id: 's3', from: 'q0', to: 'q1', input: EPSILON, pop: '', push: '', pop2: '', push2: '' },
      { id: 's4', from: 'q1', to: 'q1', input: 'b', pop: 'A', push: '', pop2: '', push2: 'B' },
      { id: 's5', from: 'q1', to: 'q2', input: EPSILON, pop: '', push: '', pop2: '', push2: '' },
      { id: 's6', from: 'q2', to: 'q2', input: 'c', pop: '', push: '', pop2: 'B', push2: '' },
      { id: 's7', from: 'q2', to: 'qf', input: EPSILON, pop: 'Z', push: '', pop2: 'Z', push2: '' },
    ],
  };
}

/** One entry per stack column of a card: the blocks it shows, and what animated. */
function readColumns(card: Element) {
  return [...card.querySelectorAll<HTMLElement>('.stack-card__stack')].map((col) => ({
    stack: [...col.querySelectorAll('.stack-card__block:not(.is-popped)')].map((b) => b.textContent),
    pushed: [...col.querySelectorAll('.stack-card__block.is-pushed')].map((b) => b.textContent),
    popped: [...col.querySelectorAll('.stack-card__block.is-popped')].map((b) => b.textContent),
    empty: col.querySelector('.stack-card__empty') !== null,
  }));
}

function liveCard(container: HTMLElement, state: string) {
  const card = [...container.querySelectorAll('.stack-card--live')].find(
    (c) => c.querySelector('.stack-card__state')?.textContent === state,
  );
  if (!card) throw new Error(`nenhum cartão ativo para ${state}`);
  return card;
}
```

E um novo `describe` no fim do arquivo:

```ts
describe('StackStrip - two stacks', () => {
  it('draws one column per stack, labelled 1 and 2', () => {
    runOn(anbncn(), 'abc');
    const { container } = render(<StackStrip />);
    goTo(2);
    const card = liveCard(container, 'q1');
    expect([...card.querySelectorAll('.stack-card__stack-label')].map((l) => l.textContent)).toEqual(['1', '2']);
    expect(readColumns(card).map((c) => c.stack)).toEqual([['Z'], ['B', 'Z']]);
  });

  it('keeps a single unlabelled column on a one-stack PDA', () => {
    runOn(palindromes(), 'abba');
    const { container } = render(<StackStrip />);
    const card = liveCard(container, 'q1');
    expect(card.querySelectorAll('.stack-card__stack')).toHaveLength(1);
    expect(card.querySelectorAll('.stack-card__stack-label')).toHaveLength(0);
  });

  it('animates each stack against its own parent', () => {
    runOn(anbncn(), 'abc');
    const { container } = render(<StackStrip />);
    goTo(2);
    // Reading 'b' popped A off stack 1 and pushed B onto stack 2.
    expect(readColumns(liveCard(container, 'q1'))).toMatchObject([
      { popped: ['A'], pushed: [] },
      { popped: [], pushed: ['B'] },
    ]);
  });

  it('shows an empty second stack as empty', () => {
    runOn(anbncn(), 'abc');
    const { container } = render(<StackStrip />);
    // At step 0 the ε-closure already reached qf by popping Z off both stacks.
    expect(readColumns(liveCard(container, 'qf')).map((c) => c.empty)).toEqual([true, true]);
  });

  it('marks the accepting configuration once the whole input is read', () => {
    runOn(anbncn(), 'abc');
    const { container } = render(<StackStrip />);
    goTo(3);
    expect(readCards(container, '.stack-card--accept').map((c) => c.state)).toEqual(['qf']);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run src/components/Canvas/StackStrip.test.tsx`
Expected: FAIL. `StackStrip` retorna `null` para `2PDA` (`automaton.kind !== 'PDA'`), então `liveCard` lança "nenhum cartão ativo".

- [ ] **Step 3: Implementar o componente**

Em `src/components/Canvas/StackStrip.tsx`:

Import de tipos:

```ts
import { formatTransitionLabel, hasStack, type Automaton } from '../../types/automaton';
```

Substituir `StackCard` inteira (da `interface CardProps` até o fim da função) por:

```tsx
interface ColumnProps {
  stack: string[];
  /** The same stack on the configuration this one came from; drives the pop/push animation. */
  parent?: string[];
  animate: boolean;
  /** Shown above the column when the card holds more than one stack. */
  label?: string;
}

function StackColumn({ stack, parent, animate, label }: ColumnProps) {
  const { popped, pushed } = animate ? stackDiff(parent, stack) : { popped: [], pushed: 0 };

  const shown = stack.length > MAX_DEPTH ? stack.slice(0, MAX_DEPTH - 1) : stack;
  const hidden = stack.length - shown.length;

  return (
    <div className="stack-card__column">
      {label && <span className="stack-card__stack-label mono">{label}</span>}
      <div className="stack-card__stack">
        {popped.map((symbol, i) => (
          <span key={`p${i}`} className="stack-card__block mono is-popped">
            {symbol}
          </span>
        ))}
        {shown.map((symbol, i) => (
          <span
            key={`s${i}`}
            className={['stack-card__block', 'mono', i === 0 && 'is-top', i < pushed && 'is-pushed']
              .filter(Boolean)
              .join(' ')}
            style={i < pushed ? ({ '--push-order': pushed - 1 - i } as CSSProperties) : undefined}
          >
            {symbol}
          </span>
        ))}
        {hidden > 0 && <span className="stack-card__block stack-card__more mono">+{hidden}</span>}
        {stack.length === 0 && popped.length === 0 && <span className="stack-card__empty">vazia</span>}
      </div>
    </div>
  );
}

interface CardProps {
  automaton: Automaton;
  branch: SimulationBranch;
  parent?: SimulationBranch;
  variant: 'live' | 'accept' | 'dead';
}

function StackCard({ automaton, branch, parent, variant }: CardProps) {
  const label = automaton.states.find((s) => s.id === branch.stateId)?.label ?? '?';
  const twoStacks = automaton.kind === '2PDA';
  const animate = variant !== 'dead';

  const via =
    variant === 'dead'
      ? []
      : branch.viaTransitionIds
          .map((id) => automaton.transitions.find((t) => t.id === id))
          .filter((t) => t !== undefined)
          .map((t) => formatTransitionLabel(automaton.kind, t));

  return (
    <div className={`stack-card stack-card--${variant}`}>
      <span className="stack-card__state mono">{label}</span>

      <div className="stack-card__stacks">
        <StackColumn stack={branch.stack} parent={parent?.stack} animate={animate} label={twoStacks ? '1' : undefined} />
        {twoStacks && <StackColumn stack={branch.stack2 ?? []} parent={parent?.stack2} animate={animate} label="2" />}
      </div>

      {variant === 'dead' ? (
        <span className="stack-card__caption stack-card__caption--dead">✕ sem transição</span>
      ) : (
        via.length > 0 && (
          <span className="stack-card__caption mono">
            {via.map((v, i) => (
              <span key={i}>{v}</span>
            ))}
          </span>
        )
      )}
    </div>
  );
}
```

Em `StackStrip`, a profundidade e a guarda:

```ts
  const depth = useMemo(() => {
    const deepest = Math.max(
      1,
      ...(simulationResult?.steps.flatMap((s) => s.branches.flatMap((b) => [b.stack.length, b.stack2?.length ?? 0])) ?? []),
    );
    return Math.min(deepest, MAX_DEPTH);
  }, [simulationResult]);

  if (!hasStack(automaton.kind) || !simulationResult) return null;
```

Atualizar o comentário de `StackStrip` para dizer "com sua própria pilha, ou suas duas pilhas num AP2".

- [ ] **Step 4: Estilo das colunas**

Em `src/components/Canvas/StackStrip.css`, logo antes de `.stack-card__stack {`:

```css
.stack-card__stacks {
  display: flex;
  align-items: flex-end;
  gap: 6px;
}

.stack-card__column {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
}

.stack-card__stack-label {
  color: var(--text-faint);
  font-size: 9px;
  line-height: 1;
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `pnpm vitest run src/components/Canvas/StackStrip.test.tsx`
Expected: PASS, incluindo os testes de PDA já existentes.

- [ ] **Step 6: Tipos, lint, suite e verificação manual**

Run: `pnpm exec tsc -b && pnpm lint && pnpm test`
Expected: sem erros.

Run: `pnpm dev`. No AP2 de aⁿbⁿcⁿ (montar pelo rótulo: `qs→q0: eps, eps>Z | eps>Z`; `q0→q0: a, eps>A | eps>eps`; `q0→q1: eps, eps>eps | eps>eps`; `q1→q1: b, A>eps | eps>B`; `q1→q2: eps, eps>eps | eps>eps`; `q2→q2: c, eps>eps | B>eps`; `q2→qf: eps, Z>eps | Z>eps`; `qf` de aceitação), simular `aabbcc` passo a passo: cada cartão mostra duas colunas rotuladas 1 e 2, ao ler `b` o A sai da coluna 1 e o B entra na 2, e no fim o cartão `qf` fica verde.

- [ ] **Step 7: Commit**

```bash
git add src/components/Canvas/StackStrip.tsx src/components/Canvas/StackStrip.css src/components/Canvas/StackStrip.test.tsx
git commit -m "feat(canvas): desenhar as duas pilhas de cada ramo de um AP2" -m "A coluna de blocos virou um componente próprio para que o cartão possa ter uma ou duas, cada uma animando contra a pilha correspondente do ramo de origem."
```
