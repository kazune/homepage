import type { GameDefinition, Position } from "../types.js";
import { step, ray, orthogonal, diagonal, gold, pieceType as type } from "../rules.js";
export const pieceTypes = Object.fromEntries([
  type("pawn", "歩", [step([0, -1])], "tokin"),
  type("lance", "香", [ray([0, -1])], "promoted-lance"),
  type("knight", "桂", [step([-1, -2]), step([1, -2])], "promoted-knight"),
  type("silver", "銀", [[0, -1] as Position, ...diagonal].map(v => step(v)), "promoted-silver"),
  type("gold", "金", gold.map(v => step(v))),
  type("bishop", "角", diagonal.map(v => ray(v)), "horse"),
  type("rook", "飛", orthogonal.map(v => ray(v)), "dragon"),
  type("king", "王", [...orthogonal, ...diagonal].map(v => step(v)), undefined, true),
  ...[
    type("tokin", "と", gold.map(v => step(v))),
    type("promoted-lance", "成香", gold.map(v => step(v))),
    type("promoted-knight", "成桂", gold.map(v => step(v))),
    type("promoted-silver", "成銀", gold.map(v => step(v))),
    type("horse", "馬", [...diagonal.map(v => ray(v)), ...orthogonal.map(v => step(v))]),
    type("dragon", "龍", [...orthogonal.map(v => ray(v)), ...diagonal.map(v => step(v))]),
  ].map(t => ({ ...t, promoted: true })),
].map(t => [t.id, t]));
const initial: GameDefinition["initial"][number][] = [];
const unpromoted: Readonly<Record<string, string>> = {
  tokin: "pawn", "promoted-lance": "lance", "promoted-knight": "knight",
  "promoted-silver": "silver", horse: "bishop", dragon: "rook",
};
const back = ["lance", "knight", "silver", "gold", "king", "gold", "silver", "knight", "lance"];
for (const owner of [0, 1] as const) {
  for (let x = 0; x < 9; x++) {
    initial.push({ type: back[x], owner, position: [x, owner === 0 ? 8 : 0] });
    initial.push({ type: "pawn", owner, position: [x, owner === 0 ? 6 : 2] });
  }
  initial.push({ type: "rook", owner, position: owner === 0 ? [7, 7] : [1, 1] });
  initial.push({ type: "bishop", owner, position: owner === 0 ? [1, 7] : [7, 1] });
}
export const shogi: GameDefinition = {
  id: "shogi", title: "将棋", width: 9, height: 9, pieceTypes, initial,
  canPromote: ({ piece, path }) => path.some(p => piece.owner === 0 ? p[1] <= 2 : p[1] >= 6),
  captureToHand: piece => pieceTypes[piece.type].royal ? null : unpromoted[piece.type] ?? piece.type,
  canDrop: piece => !pieceTypes[piece.type].royal && !pieceTypes[piece.type].promoted,
  validateTurn: ({ after, transaction }) => {
    const files = new Set<number>();
    for (const [id, location] of after.locations) {
      const piece = after.pieces.get(id)!;
      if (piece.owner !== transaction.playerBefore || location.kind !== "board") continue;
      const [x, y] = location.position;
      const depth = piece.owner === 0 ? y : after.height - 1 - y;
      if (((piece.type === "pawn" || piece.type === "lance") && depth === 0) ||
          (piece.type === "knight" && depth <= 1)) {
        return `行き所のない駒：${pieceTypes[piece.type].name}を移動できない段に置きました。`;
      }
      if (piece.type === "pawn") {
        if (files.has(x)) return "二歩：同じ筋に不成の歩を2枚置きました。";
        files.add(x);
      }
    }
    return null;
  },
};
