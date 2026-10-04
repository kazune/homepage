import type { GameDefinition, Position } from "../types.js";
import { step, ray, orthogonal, diagonal, pieceType as type } from "../rules.js";
import { chuPieceTypes } from "./chu-shogi.js";

// Dai shares Chu's 21 base pieces and their promotions. Its eight additional
// pieces all promote to gold, with a distinct type so they cannot promote again.
const wolfDirections: readonly Position[] = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0]];
const additions = [
  type("stone", "石将", [step([-1, -1]), step([1, -1])]),
  type("iron", "鉄将", [step([-1, -1]), step([0, -1]), step([1, -1])]),
  type("knight", "桂馬", [step([-1, -2]), step([1, -2])]),
  type("angry-boar", "嗔猪", orthogonal.map(v => step(v))),
  type("cat-sword", "猫刃", diagonal.map(v => step(v))),
  type("evil-wolf", "悪狼", wolfDirections.map(v => step(v))),
  type("violent-ox", "猛牛", orthogonal.map(v => ray(v, 2))),
  type("flying-dragon", "飛龍", diagonal.map(v => ray(v, 2))),
];
export const daiPieceTypes = {
  ...chuPieceTypes,
  ...Object.fromEntries(additions.flatMap(piece => [
    [piece.id, { ...piece, promoteTo: `promoted-${piece.id}` }],
    [`promoted-${piece.id}`, { ...chuPieceTypes.gold, id: `promoted-${piece.id}`, promoteTo: undefined, promoted: true }],
  ])),
};

// Sente's camp, from the back rank toward the centre. Gote is rotated 180°.
const rows: (string | null)[][] = [
  ["lance", "knight", "stone", "iron", "copper", "silver", "gold", "king", "gold", "silver", "copper", "iron", "stone", "knight", "lance"],
  ["reverse-chariot", null, "cat-sword", null, "leopard", null, "tiger", "elephant", "tiger", null, "leopard", null, "cat-sword", null, "reverse-chariot"],
  [null, "violent-ox", null, "angry-boar", null, "evil-wolf", "kirin", "lion", "phoenix", "evil-wolf", null, "angry-boar", null, "violent-ox", null],
  ["rook", "flying-dragon", "side-mover", "vertical-mover", "bishop", "horse", "dragon", "queen", "dragon", "horse", "bishop", "vertical-mover", "side-mover", "flying-dragon", "rook"],
  Array(15).fill("pawn"),
  [null, null, null, null, "go-between", null, null, null, null, null, "go-between", null, null, null, null],
];
const initial: GameDefinition["initial"][number][] = [];
for (const owner of [0, 1] as const) rows.forEach((row, depth) => row.forEach((id, x) => {
  if (id) initial.push({ type: id, owner, position: owner === 0 ? [x, 14 - depth] : [14 - x, depth] });
}));

export const daiShogi: GameDefinition = {
  id: "dai", title: "大将棋", width: 15, height: 15, pieceTypes: daiPieceTypes, initial,
  // No drops, lion-trading restrictions or last-rank promotion exception.
  canPromote: ({ piece, path, captured }) => {
    const inZone = (p: Position) => piece.owner === 0 ? p[1] <= 4 : p[1] >= 10;
    const entered = path.some((p, index) => index > 0 && inZone(p) && !inZone(path[index - 1]));
    return entered || (captured && path.some(inZone));
  },
};
