import type { GameDefinition } from "../types.js";
import { step, orthogonal, diagonal, kingDirections, gold, pieceType } from "../rules.js";

export const dobutsuPieceTypes = Object.fromEntries([
  pieceType("lion", "ライオン", kingDirections.map(step), undefined, true),
  pieceType("elephant", "ぞう", diagonal.map(step)),
  pieceType("giraffe", "きりん", orthogonal.map(step)),
  pieceType("chick", "ひよこ", [step([0, -1])], "hen"),
  { ...pieceType("hen", "にわとり", gold.map(step)), promoted: true },
].map(type => [type.id, type]));

const initial: GameDefinition["initial"][number][] = [];
for (const owner of [0, 1] as const) {
  for (const [x, type] of ["elephant", "lion", "giraffe"].entries()) {
    initial.push({ type, owner, position: owner === 0 ? [x, 3] : [2 - x, 0] });
  }
  initial.push({ type: "chick", owner, position: [1, owner === 0 ? 2 : 1] });
}

export const dobutsuShogi: GameDefinition = {
  id: "dobutsu", title: "どうぶつしょうぎ", width: 3, height: 4,
  pieceTypes: dobutsuPieceTypes, initial,
  canPromote: ({ piece, path }) => path[path.length - 1][1] === (piece.owner === 0 ? 0 : 3),
  captureToHand: piece => piece.type === "lion" ? null : piece.type === "hen" ? "chick" : piece.type,
  canDrop: piece => ["chick", "elephant", "giraffe"].includes(piece.type),
  validateTurn: ({ after, transaction }) => {
    const move = transaction.transfers.find(t => t.from.kind === "board" && t.to.kind === "board");
    if (move && move.to.kind === "board") {
      const piece = after.pieces.get(move.pieceId)!;
      if (piece.type === "chick" && move.to.position[1] === (piece.owner === 0 ? 0 : 3) &&
          after.locations.get(piece.id)?.kind === "board") {
        return "成り必須：ひよこは最奥段へ進むとにわとりに成る必要があります。";
      }
    }
    for (const [id, location] of after.locations) {
      const piece = after.pieces.get(id)!;
      if (piece.owner !== transaction.playerBefore && piece.type === "lion" && location.kind === "board" &&
          location.position[1] === (piece.owner === 0 ? 0 : after.height - 1)) {
        return "トライ：相手のライオンが最奥段に残ったまま手を終了しました。";
      }
    }
    return null;
  },
};
