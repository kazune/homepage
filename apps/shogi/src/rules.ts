import type { Context, Result, Position, MovementRule, PieceType, SequenceRule } from "./types.js";
export const samePosition = (a: Position, b: Position): boolean => a[0] === b[0] && a[1] === b[1];
export const passEmpty = ({ target }: Context): Result => ({ allow: target === null });
export const landNormal = ({ mover, target }: Context): Result => {
  if (!target || target.id === mover.id) return { allow: true };
  if (target.owner === mover.owner) return { allow: false };
  return { allow: true, effects: [{ type: "capture", pieceId: target.id }] };
};
export const ray = (vector: Position, max: number | null): MovementRule => ({
  vector, range: { min: 1, max }, pass: passEmpty, land: landNormal,
});
export const step = (vector: Position): MovementRule => ray(vector, 1);
export const slide = (vector: Position): MovementRule => ray(vector, null);
export const orthogonal: readonly Position[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export const diagonal: readonly Position[] = [[1, 1], [-1, 1], [1, -1], [-1, -1]];
export const kingDirections = [...orthogonal, ...diagonal];
export const gold: readonly Position[] = [[0, -1], [-1, -1], [1, -1], [-1, 0], [1, 0], [0, 1]];
export const sequence = (...stages: MovementRule[][]): SequenceRule => ({ stages: stages.map(movements => ({ movements })) });
export function pieceType(id: string, name: string, movements: MovementRule[], promoteTo?: string, royal = false): PieceType {
  return { id, name, rank: 0, royal, sequences: [sequence(movements)], promoteTo };
}
