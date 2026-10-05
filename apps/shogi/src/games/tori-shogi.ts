import type { GameDefinition, Piece, Position } from "../types.js";
import { step, slide, ray, kingDirections, diagonal, pieceType as type } from "../rules.js";

export const toriPieceTypes = Object.fromEntries([
  type("phoenix", "鵬", kingDirections.map(v => step(v)), undefined, true),
  type("falcon", "鷹", kingDirections.filter(v => v[0] !== 0 || v[1] !== 1).map(v => step(v)), "eagle"),
  type("crane", "鶴", [[0, -1] as Position, [0, 1] as Position, ...diagonal].map(v => step(v))),
  type("pheasant", "雉", [step([0, -2]), step([-1, 1]), step([1, 1])]),
  type("left-quail", "左鶉", [slide([0, -1]), slide([1, 1]), step([-1, 1])]),
  type("right-quail", "右鶉", [slide([0, -1]), slide([-1, 1]), step([1, 1])]),
  type("swallow", "燕", [step([0, -1])], "goose"),
  { ...type("goose", "鴈", [step([-2, -2]), step([2, -2]), step([0, 2])]), promoted: true },
  { ...type("eagle", "鵰", [
    slide([-1, -1]), slide([1, -1]), slide([0, 1]),
    step([0, -1]), step([-1, 0]), step([1, 0]), ray([-1, 1], 2), ray([1, 1], 2),
  ]), promoted: true },
].map(piece => [piece.id, piece]));

// Sente's camp from its back rank. Rotate positions, including the advanced
// swallow and the distinct left/right quails, for Gote.
const rows: (string | null)[][] = [
  ["left-quail", "pheasant", "crane", "phoenix", "crane", "pheasant", "right-quail"],
  [null, null, null, "falcon", null, null, null],
  Array(7).fill("swallow"),
  [null, null, null, null, "swallow", null, null],
];
const initial: GameDefinition["initial"][number][] = [];
for (const owner of [0, 1] as const) rows.forEach((row, depth) => row.forEach((id, x) => {
  if (id) initial.push({ type: id, owner, position: owner === 0 ? [x, 6 - depth] : [6 - x, depth] });
}));

const inZone = (piece: Piece, position: Position): boolean => piece.owner === 0 ? position[1] <= 1 : position[1] >= 5;
const unpromoted: Readonly<Record<string, string>> = { goose: "swallow", eagle: "falcon" };

export const toriShogi: GameDefinition = {
  id: "tori", title: "禽将棋", width: 7, height: 7, pieceTypes: toriPieceTypes, initial,
  canPromote: ({ piece, path }) => path.some(position => inZone(piece, position)),
  captureToHand: piece => toriPieceTypes[piece.type].royal ? null : unpromoted[piece.type] ?? piece.type,
  canDrop: piece => !toriPieceTypes[piece.type].royal && !toriPieceTypes[piece.type].promoted,
  validateTurn: ({ after, transaction }) => {
    const move = transaction.transfers.find(t => t.from.kind === "board" && t.to.kind === "board");
    if (move && move.from.kind === "board" && move.to.kind === "board") {
      const piece = after.pieces.get(move.pieceId)!;
      if (toriPieceTypes[piece.type].promoteTo &&
          (inZone(piece, move.from.position) || inZone(piece, move.to.position)) &&
          after.locations.get(piece.id)?.kind === "board") {
        return `成り必須：${toriPieceTypes[piece.type].name}は敵陣2段に関わる移動で成る必要があります。`;
      }
    }
    const files = new Map<number, number>();
    for (const [id, location] of after.locations) {
      const piece = after.pieces.get(id)!;
      if (piece.owner !== transaction.playerBefore || piece.type !== "swallow" || location.kind !== "board") continue;
      const [x, y] = location.position;
      if (piece.owner === 0 ? y === 0 : y === 6) return "行き所のない駒：燕を最奥段に置きました。";
      const count = (files.get(x) ?? 0) + 1;
      if (count > 2) return "三燕：同じ筋に不成の燕を3枚置きました。";
      files.set(x, count);
    }
    return null;
  },
};
