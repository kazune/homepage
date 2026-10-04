import type { GameDefinition, MovementRule, PieceType, Position, SequenceRule } from "../types.js";
import { step, ray, orthogonal, diagonal, gold, kingDirections, sequence, pieceType as type } from "../rules.js";
import { validateLionRules } from "./chu-special.js";
const steps = (directions: readonly Position[]) => directions.map(v => step(v));
const rays = (directions: readonly Position[]) => directions.map(v => ray(v));
const vertical: Position[] = [[0, -1], [0, 1]];
const horizontal: Position[] = [[-1, 0], [1, 0]];
const forwardDiagonal: Position[] = [[-1, -1], [1, -1]];
const backDiagonal: Position[] = [[-1, 1], [1, 1]];

// Short and long sequences share their first stage. The second stage stays on
// the selected forward line for falcon/eagle; lions can change direction.
function partialLion(directions: readonly Position[]): SequenceRule[] {
  return directions.flatMap(([dx, dy]) => [
    sequence([step([dx, dy])]),
    sequence([step([dx, dy])], [step([dx, dy]), step([-dx, -dy])]),
    sequence([step([dx * 2, dy * 2])]),
  ]);
}
const lionSteps = steps(kingDirections);
const lionJumps: MovementRule[] = [];
for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) {
  if (Math.max(Math.abs(dx), Math.abs(dy)) === 2) lionJumps.push(step([dx, dy]));
}
const lion = {
  ...type("lion", "獅子", []),
  sequences: [sequence(lionSteps), sequence(lionSteps, lionSteps), sequence(lionJumps)],
};
const targets = [
  type("prince", "太子", steps(kingDirections), undefined, true),
  type("stag", "飛鹿", [...rays(vertical), ...steps([...horizontal, ...diagonal])]),
  type("ox", "飛牛", rays([...vertical, ...diagonal])),
  type("boar", "奔猪", rays([...horizontal, ...diagonal])),
  type("whale", "鯨鯢", rays([...vertical, ...backDiagonal])),
  type("white-horse", "白駒", rays([...vertical, ...forwardDiagonal])),
  { ...type("falcon", "角鷹", []), sequences: [sequence(rays(kingDirections.filter(([dx, dy]) => dx !== 0 || dy !== -1))), ...partialLion([[0, -1]])] },
  { ...type("eagle", "飛鷲", []), sequences: [sequence(rays([...orthogonal, ...backDiagonal])), ...partialLion(forwardDiagonal)] },
];
const bases: PieceType[] = [
  type("king", "王将", steps(kingDirections), undefined, true),
  type("queen", "奔王", rays(kingDirections)), lion,
  type("pawn", "歩兵", [step([0, -1])], "gold"),
  type("go-between", "仲人", steps(vertical), "elephant"),
  type("lance", "香車", rays([[0, -1]]), "white-horse"),
  type("reverse-chariot", "反車", rays(vertical), "whale"),
  type("leopard", "猛豹", steps([...vertical, ...diagonal]), "bishop"),
  type("copper", "銅将", steps([[0, -1], ...forwardDiagonal, [0, 1]]), "side-mover"),
  type("silver", "銀将", steps([[0, -1], ...diagonal]), "vertical-mover"),
  type("gold", "金将", steps(gold), "rook"),
  type("elephant", "酔象", steps(kingDirections.filter(([dx, dy]) => dx !== 0 || dy !== 1)), "prince"),
  type("tiger", "盲虎", steps(kingDirections.filter(([dx, dy]) => dx !== 0 || dy !== -1)), "stag"),
  type("kirin", "麒麟", [...steps(diagonal), ...steps(orthogonal.map(([x, y]) => [x * 2, y * 2] as Position))], "lion"),
  type("phoenix", "鳳凰", [...steps(orthogonal), ...steps(diagonal.map(([x, y]) => [x * 2, y * 2] as Position))], "queen"),
  type("bishop", "角行", rays(diagonal), "horse"),
  type("rook", "飛車", rays(orthogonal), "dragon"),
  type("horse", "龍馬", [...rays(diagonal), ...steps(orthogonal)], "falcon"),
  type("dragon", "龍王", [...rays(orthogonal), ...steps(diagonal)], "eagle"),
  type("side-mover", "横行", [...rays(horizontal), ...steps(vertical)], "boar"),
  type("vertical-mover", "竪行", [...rays(vertical), ...steps(horizontal)], "ox"),
];
const lookup = Object.fromEntries([...bases, ...targets].map(t => [t.id, t]));
// A promoted gold is a rook, but cannot promote again. Give every promoted
// instance a distinct type, even when its movement matches an initial piece.
export const chuPieceTypes = Object.fromEntries([
  ...bases.map(t => ({ ...t, promoteTo: t.promoteTo ? `promoted-${t.id}` : undefined })),
  ...bases.filter(t => t.promoteTo).map(t => ({
    ...lookup[t.promoteTo!], id: `promoted-${t.id}`, promoteTo: undefined, promoted: true,
  })),
].map(t => [t.id, t]));
const rows: (string | null)[][] = [
  ["lance", "leopard", "copper", "silver", "gold", "king", "elephant", "gold", "silver", "copper", "leopard", "lance"],
  ["reverse-chariot", null, "bishop", null, "tiger", "kirin", "phoenix", "tiger", null, "bishop", null, "reverse-chariot"],
  ["side-mover", "vertical-mover", "rook", "horse", "dragon", "lion", "queen", "dragon", "horse", "rook", "vertical-mover", "side-mover"],
  Array(12).fill("pawn"),
  [null, null, null, "go-between", null, null, null, null, "go-between", null, null, null],
];
const initial: GameDefinition["initial"][number][] = [];
for (const owner of [0, 1] as const) rows.forEach((row, depth) => row.forEach((id, x) => {
  if (id) initial.push({ type: id, owner, position: owner === 0 ? [x, 11 - depth] : [11 - x, depth] });
}));
export const chuShogi: GameDefinition = {
  id: "chu", title: "中将棋", width: 12, height: 12, pieceTypes: chuPieceTypes, initial,
  validateTurn: context => validateLionRules(context, chuPieceTypes),
  canPromote: ({ piece, path, captured }) => {
    const inZone = (p: Position) => piece.owner === 0 ? p[1] <= 3 : p[1] >= 8;
    const entered = path.some((p, index) => index > 0 && inZone(p) && !inZone(path[index - 1]));
    const last = path[path.length - 1];
    return entered || (captured && path.some(inZone)) || (piece.type === "pawn" && last[1] === (piece.owner === 0 ? 0 : 11));
  },
};
