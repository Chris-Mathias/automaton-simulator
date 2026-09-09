import { BLANK, TAPE_MOVE_LABELS, type TapeMove } from '../../types/automaton';

/** Read/write options on a TM: the declared tape alphabet plus the blank. */
export function tapeSymbolOptions(tapeAlphabet: string[] | undefined): string[] {
  return [...new Set([...(tapeAlphabet ?? []), BLANK])];
}

/** Head movements, in the order they're offered. Compact rows render
 *  `TAPE_MOVE_LABELS[value]` instead of the spelled-out label. */
export const MOVE_OPTIONS: [TapeMove, string][] = [
  ['L', `${TAPE_MOVE_LABELS.L} — esquerda`],
  ['R', `${TAPE_MOVE_LABELS.R} — direita`],
  ['S', `${TAPE_MOVE_LABELS.S} — parado`],
];
