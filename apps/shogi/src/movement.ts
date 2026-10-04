import type { Board, Context, Effect, MovementRule, Piece, PieceType, Position } from "./types.js";
export type Landing = Readonly<{ position: Position; effects: readonly Effect[] }>;

// Movement only: this deliberately does not apply game-specific turn rules.
export function evaluateMovements(board: Board, piece: Piece, from: Position,
  movements: readonly MovementRule[], pieceTypeOf: (piece: Piece) => PieceType): Landing[] {
  const landings: Landing[] = [];
  const rotation = piece.owner === 0 ? 1 : -1;
  for (const rule of movements) {
    const [dx, dy] = rule.vector.map(v => v * rotation);
    const limit = dx === 0 && dy === 0 ? 1 : rule.range.max ?? Infinity;
    const effects: Effect[] = [];
    for (let distance = 1; distance <= limit; distance++) {
      const position: Position = [from[0] + dx * distance, from[1] + dy * distance];
      const target = board.pieceAt(position);
      if (target === undefined) break;
      const context: Context = { board, mover: piece, from, position, distance, target, pieceTypeOf };
      if (distance >= rule.range.min) {
        const land = rule.land(context);
        if (land.allow) landings.push({ position, effects: [...effects, ...land.effects ?? []] });
      }
      if (distance === limit) break;
      const pass = rule.pass(context);
      if (!pass.allow) break;
      effects.push(...pass.effects ?? []);
    }
  }
  return landings;
}
