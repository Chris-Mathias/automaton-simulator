import { EPSILON, type Automaton } from '../types/automaton';

export interface ValidationIssue {
  id: string;
  severity: 'error' | 'warning';
  message: string;
  stateId?: string;
  transitionId?: string;
}

export function validate(automaton: Automaton): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const stateIds = new Set(automaton.states.map((s) => s.id));

  if (!automaton.startStateId) {
    issues.push({ id: 'no-start', severity: 'error', message: 'Nenhum estado inicial definido.' });
  }

  if (!automaton.states.some((s) => s.isAccept)) {
    issues.push({ id: 'no-accept', severity: 'warning', message: 'Nenhum estado de aceitação definido.' });
  }

  for (const t of automaton.transitions) {
    if (!stateIds.has(t.from)) {
      issues.push({
        id: `dangling-from-${t.id}`,
        severity: 'error',
        message: `Transição "${t.id}" sai de um estado que não existe mais.`,
        transitionId: t.id,
      });
    }
    if (!stateIds.has(t.to)) {
      issues.push({
        id: `dangling-to-${t.id}`,
        severity: 'error',
        message: `Transição "${t.id}" chega em um estado que não existe mais.`,
        transitionId: t.id,
      });
    }
    if (t.input !== EPSILON && !automaton.alphabet.includes(t.input)) {
      issues.push({
        id: `symbol-outside-alphabet-${t.id}`,
        severity: 'error',
        message: `Transição usa o símbolo "${t.input}", que não está no alfabeto declarado — ela é ignorada na conversão AFN→AFD.`,
        transitionId: t.id,
      });
    }
  }

  if (automaton.startStateId && stateIds.has(automaton.startStateId)) {
    const reachable = new Set<string>([automaton.startStateId]);
    const queue = [automaton.startStateId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const t of automaton.transitions) {
        if (t.from === current && !reachable.has(t.to)) {
          reachable.add(t.to);
          queue.push(t.to);
        }
      }
    }
    for (const s of automaton.states) {
      if (!reachable.has(s.id)) {
        issues.push({
          id: `unreachable-${s.id}`,
          severity: 'warning',
          message: `Estado "${s.label}" é inalcançável a partir do estado inicial.`,
          stateId: s.id,
        });
      }
    }
  }

  if (automaton.kind === 'DFA') {
    for (const s of automaton.states) {
      const bySymbol = new Map<string, number>();
      for (const t of automaton.transitions.filter((t) => t.from === s.id)) {
        bySymbol.set(t.input, (bySymbol.get(t.input) ?? 0) + 1);
      }
      for (const [symbol, count] of bySymbol) {
        if (count > 1) {
          issues.push({
            id: `nondeterminism-${s.id}-${symbol}`,
            severity: 'error',
            message: `Estado "${s.label}" tem mais de uma transição pelo símbolo "${symbol}" (isso não é permitido em um AFD).`,
            stateId: s.id,
          });
        }
      }
      for (const symbol of automaton.alphabet) {
        if (!bySymbol.has(symbol)) {
          issues.push({
            id: `incomplete-${s.id}-${symbol}`,
            severity: 'warning',
            message: `Estado "${s.label}" não tem transição definida para o símbolo "${symbol}".`,
            stateId: s.id,
          });
        }
      }
    }
  }

  return issues;
}
