import type { Context, GameDefinition, MovementRule, PieceType, Position, Result, SequenceRule } from "../types.js";
import { kingDirections, ray, sequence, slide, step } from "../rules.js";
import { taikyokuData, taikyokuRows, type BasicMoves, type MoveData } from "./taikyoku-data.js";

const ranks: Readonly<Record<string, number>> = { K: 4, CP: 4, GG: 3, VG: 2, FLG: 1, AG: 1, FID: 1, FCR: 1 };
const rangeCapturers = new Set(["GG", "VG", "FLG", "AG", "FID", "FCR"]);
const royal = (id: string) => id === "K" || id === "CP";
const captureLower = ({ mover, target, pieceTypeOf }: Context): Result => {
  if (!target || target.id === mover.id) return { allow: true };
  return pieceTypeOf(target).rank < pieceTypeOf(mover).rank
    ? { allow: true, effects: [{ type: "capture", pieceId: target.id }] }
    : { allow: false };
};
const landEmpty = (context: Context): Result => ({ allow: !context.target || context.target.id === context.mover.id });

function basicMoves(data: BasicMoves, rangedCapture = false): MovementRule[] {
  return [
    ...data.rays.map(([vector, max]) => {
      const rule = max === 1 ? step(vector) : max === null ? slide(vector) : ray(vector, max);
      return rangedCapture && max === null ? { ...rule, pass: captureLower, land: captureLower } : rule;
    }),
    ...data.jumps.map(vector => step(vector)),
  ];
}

// Count intervening pieces from the board each time. No mutable counter leaks
// between candidate evaluations, and a landing does not count as a jump-over.
function skipThree(vector: Position): MovementRule {
  return { ...slide(vector), pass: ({ board, from, position, distance, mover }) => {
    const dx = (position[0] - from[0]) / distance;
    const dy = (position[1] - from[1]) / distance;
    let occupied = 0;
    for (let i = 1; i <= distance; i++) {
      const piece = board.pieceAt([from[0] + dx * i, from[1] + dy * i]);
      if (piece && piece.id !== mover.id) occupied++;
    }
    return { allow: occupied <= 3 };
  } };
}

function sequences(id: string, data: MoveData): SequenceRule[] {
  const result = [sequence([...basicMoves(data, rangeCapturers.has(id)), ...data.skip.map(skipThree)])];
  for (const [first, second, afterCapture] of data.compounds) {
    const movements = basicMoves(first);
    // A capture at the pivot ends hook and jump-then-slide moves. A separate
    // empty-pivot sequence preserves continuation only for noncaptures.
    result.push(sequence(movements));
    result.push(sequence(afterCapture ? movements : movements.map(rule => ({ ...rule, land: landEmpty })), basicMoves(second)));
  }
  if (id === "FE") {
    for (const vector of kingDirections) {
      const length = vector[1] === -1 && vector[0] !== 0 ? 4 : 3;
      const stages = Array.from({ length }, () => [step(vector)]);
      // Enumerate the full sweep and sweep-then-slide. Never end a sweep after
      // its second capture, nor combine its effects with a direct jump.
      result.push(sequence(...stages), sequence(...stages, [slide(vector)]));
    }
  }
  return result.filter(rule => rule.stages.every(stage => stage.movements.length > 0));
}

const baseTypes = Object.fromEntries(taikyokuData.map(([id, name, promotion, moves]) => [id, {
  id, name, rank: ranks[id] ?? 0, royal: royal(id), sequences: sequences(id, moves),
  promoteTo: promotion ? `promoted-${id}` : undefined,
} satisfies PieceType]));

export const taikyokuPieceTypes: Readonly<Record<string, PieceType>> = {
  ...baseTypes,
  ...Object.fromEntries(taikyokuData.filter(([, , promotion]) => promotion).map(([id, , promotion]) => [
    `promoted-${id}`, { ...baseTypes[promotion!], id: `promoted-${id}`, promoted: true, promoteTo: undefined },
  ])),
};

const initial: GameDefinition["initial"][number][] = [];
for (const owner of [0, 1] as const) taikyokuRows.forEach((row, depth) => row.forEach((id, x) => {
  if (id) initial.push({ type: id, owner, position: owner === 0 ? [x, 35 - depth] : [35 - x, depth] });
}));

export const taikyokuShogi: GameDefinition = {
  id: "taikyoku", title: "大局将棋", width: 36, height: 36, pieceTypes: taikyokuPieceTypes, initial,
  // Optional promotion when the move touches the opponent's eleven ranks.
  canPromote: ({ piece, path }) => path.some(p => piece.owner === 0 ? p[1] <= 10 : p[1] >= 25),
};
