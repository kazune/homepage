export type PlayerId = 0 | 1;
export type Position = readonly [number, number];
export type Piece = Readonly<{ id: number; type: string; owner: PlayerId }>;
export type Location =
  | Readonly<{ kind: "board"; position: Position }>
  | Readonly<{ kind: "hand" }>
  | Readonly<{ kind: "void" }>;
export type Transfer = Readonly<{ pieceId: number; from: Location; to: Location }>;
export type Transaction = Readonly<{
  playerBefore: PlayerId;
  playerAfter: PlayerId;
  transfers: readonly Transfer[];
}>;
type Effect = Readonly<{ type: "capture"; pieceId: number }>;
type Result = Readonly<{ allow: boolean; effects?: readonly Effect[] }>;
type Context = Readonly<{
  board: Game; mover: Piece; from: Position; position: Position;
  distance: number; target: Piece | null; pieceTypeOf: (piece: Piece) => PieceType;
}>;
export type MovementRule = Readonly<{
  vector: Position;
  range: Readonly<{ min: number; max: number | null }>;
  pass: (context: Context) => Result;
  land: (context: Context) => Result;
}>;
export type SequenceStage = Readonly<{ movements: readonly MovementRule[] }>;
export type SequenceRule = Readonly<{ stages: readonly SequenceStage[] }>;
export type PieceType = Readonly<{
  id: string; name: string; rank: number; royal: boolean;
  sequences: readonly SequenceRule[]; promoteTo?: string;
}>;
export type Outcome = PlayerId | "draw" | null;
const VOID: Location = { kind: "void" };
export const samePosition = (a: Position, b: Position): boolean => a[0] === b[0] && a[1] === b[1];
const passEmpty = ({ target }: Context): Result => ({ allow: target === null });
const landNormal = ({ mover, target }: Context): Result => {
  if (!target || target.id === mover.id) return { allow: true };
  if (target.owner === mover.owner) return { allow: false };
  return { allow: true, effects: [{ type: "capture", pieceId: target.id }] };
};
const step = (vector: Position, max: number | null = 1): MovementRule => ({
  vector, range: { min: 1, max }, pass: passEmpty, land: landNormal,
});
const orthogonal: Position[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const diagonal: Position[] = [[1, 1], [-1, 1], [1, -1], [-1, -1]];
const gold: Position[] = [[0, -1], [-1, -1], [1, -1], [-1, 0], [1, 0], [0, 1]];
function type(id: string, name: string, movements: MovementRule[], promoteTo?: string, royal = false): PieceType {
  return { id, name, rank: 0, royal, sequences: [{ stages: [{ movements }] }], promoteTo };
}
export const pieceTypes: Readonly<Record<string, PieceType>> = Object.fromEntries([
  type("pawn", "歩", [step([0, -1])], "tokin"),
  type("lance", "香", [step([0, -1], null)], "promoted-lance"),
  type("knight", "桂", [step([-1, -2]), step([1, -2])], "promoted-knight"),
  type("silver", "銀", [[0, -1] as Position, ...diagonal].map(v => step(v)), "promoted-silver"),
  type("gold", "金", gold.map(v => step(v))),
  type("bishop", "角", diagonal.map(v => step(v, null)), "horse"),
  type("rook", "飛", orthogonal.map(v => step(v, null)), "dragon"),
  type("king", "王", [...orthogonal, ...diagonal].map(v => step(v)), undefined, true),
  type("tokin", "と", gold.map(v => step(v))),
  type("promoted-lance", "成香", gold.map(v => step(v))),
  type("promoted-knight", "成桂", gold.map(v => step(v))),
  type("promoted-silver", "成銀", gold.map(v => step(v))),
  type("horse", "馬", [...diagonal.map(v => step(v, null)), ...orthogonal.map(v => step(v))]),
  type("dragon", "龍", [...orthogonal.map(v => step(v, null)), ...diagonal.map(v => step(v))]),
].map(t => [t.id, t]));

export class Game {
  readonly pieces = new Map<number, Piece>();
  readonly locations = new Map<number, Location>();
  readonly history: Transaction[] = [];
  turn: PlayerId = 0;
  pending: Transaction | null = null;
  private nextId = 1;

  constructor(initial = true) { if (initial) this.setup(); }

  private setup(): void {
    const back = ["lance", "knight", "silver", "gold", "king", "gold", "silver", "knight", "lance"];
    for (const owner of [0, 1] as const) {
      const home = owner === 0 ? 8 : 0;
      for (let x = 0; x < 9; x++) {
        this.addPiece(back[x], owner, [x, home]);
        this.addPiece("pawn", owner, [x, owner === 0 ? 6 : 2]);
      }
      this.addPiece("rook", owner, owner === 0 ? [7, 7] : [1, 1]);
      this.addPiece("bishop", owner, owner === 0 ? [1, 7] : [7, 1]);
    }
  }

  addPiece(typeId: string, owner: PlayerId, position?: Position): Piece {
    if (!pieceTypes[typeId]) throw new Error("未知の駒種です");
    if (position && (this.pieceAt(position) !== null)) throw new Error("駒を配置できません");
    const piece: Piece = { id: this.nextId++, type: typeId, owner };
    this.pieces.set(piece.id, piece);
    this.locations.set(piece.id, position ? { kind: "board", position } : VOID);
    return piece;
  }

  pieceTypeOf = (piece: Piece): PieceType => pieceTypes[piece.type];

  pieceAt(position: Position): Piece | null | undefined {
    if (!position.every(Number.isInteger) || position.some(v => v < 0 || v >= 9)) return undefined;
    for (const [id, location] of this.locations) {
      if (location.kind === "board" && samePosition(location.position, position)) return this.pieces.get(id)!;
    }
    return null;
  }

  // Each standard piece has one stage. Keep sequence definitions shared with future variants.
  private evaluate(piece: Piece): Map<string, { position: Position; effects: readonly Effect[] }> {
    const location = this.locations.get(piece.id);
    const candidates = new Map<string, { position: Position; effects: readonly Effect[] }>();
    if (location?.kind !== "board") return candidates;
    const from = location.position;
    const rotation = piece.owner === 0 ? 1 : -1;
    for (const sequence of this.pieceTypeOf(piece).sequences) {
      for (const rule of sequence.stages[0].movements) {
        const [dx, dy] = rule.vector.map(v => v * rotation);
        const limit = dx === 0 && dy === 0 ? 1 : rule.range.max ?? Infinity;
        const effects: Effect[] = [];
        for (let distance = 1; distance <= limit; distance++) {
          const position: Position = [from[0] + dx * distance, from[1] + dy * distance];
          const target = this.pieceAt(position);
          if (target === undefined) break;
          const context: Context = { board: this, mover: piece, from, position, distance, target, pieceTypeOf: this.pieceTypeOf };
          if (distance >= rule.range.min) {
            const land = rule.land(context);
            if (land.allow) {
              const combined = [...effects, ...land.effects ?? []];
              const key = position.join(",");
              const previous = candidates.get(key);
              const signature = (items: readonly Effect[]) => JSON.stringify([...new Set(items.map(e => e.pieceId))].sort((a, b) => a - b));
              if (previous && signature(previous.effects) !== signature(combined)) {
                throw new Error("同じ着地点の移動効果が異なります");
              }
              candidates.set(key, { position, effects: combined });
            }
          }
          if (distance === limit) break;
          const pass = rule.pass(context);
          if (!pass.allow) break;
          effects.push(...pass.effects ?? []);
        }
      }
    }
    return candidates;
  }

  candidates(piece: Piece): readonly Position[] {
    if (piece.owner !== this.turn || this.pending || this.outcome !== null) return [];
    return [...this.evaluate(piece).values()].map(c => c.position);
  }

  canPromote(piece: Piece, from: Position, to: Position): boolean {
    const inZone = (position: Position) => piece.owner === 0 ? position[1] <= 2 : position[1] >= 6;
    return !!this.pieceTypeOf(piece).promoteTo && (inZone(from) || inZone(to));
  }

  private transfer(pieceId: number, to: Location): void {
    if (!this.pending) throw new Error("手が開始されていません");
    const from = this.locations.get(pieceId)!;
    this.locations.set(pieceId, to);
    this.pending = { ...this.pending, transfers: [...this.pending.transfers, { pieceId, from, to }] };
  }

  move(pieceId: number, to: Position): boolean {
    const piece = this.pieces.get(pieceId);
    if (!piece || piece.owner !== this.turn || this.pending || this.outcome !== null) throw new Error("移動できません");
    const candidate = this.evaluate(piece).get(to.join(","));
    const from = this.locations.get(pieceId)!;
    if (!candidate || from.kind !== "board") throw new Error("移動できません");
    this.pending = { playerBefore: this.turn, playerAfter: this.turn, transfers: [] };
    for (const effect of candidate.effects) this.transfer(effect.pieceId, VOID);
    this.transfer(pieceId, { kind: "board", position: to });
    const promotion = this.canPromote(piece, from.position, to);
    if (!promotion) this.finish();
    return promotion;
  }

  completePromotion(pieceId: number, promote: boolean): void {
    const piece = this.pieces.get(pieceId);
    const transfer = this.pending?.transfers[this.pending.transfers.length - 1];
    if (!piece || !transfer || transfer.pieceId !== pieceId || transfer.from.kind !== "board" || transfer.to.kind !== "board" ||
        !this.canPromote(piece, transfer.from.position, transfer.to.position)) throw new Error("成りを選択できません");
    if (promote) {
      this.transfer(pieceId, VOID);
      const replacement = this.addPiece(this.pieceTypeOf(piece).promoteTo!, piece.owner);
      this.transfer(replacement.id, transfer.to);
    }
    this.finish();
  }

  private finish(): void {
    if (!this.pending) return;
    const after: PlayerId = this.turn === 0 ? 1 : 0;
    this.history.push({ ...this.pending, playerAfter: after });
    this.turn = after;
    this.pending = null;
  }

  undo(): boolean {
    const transaction = this.pending ?? this.history.pop();
    if (!transaction) return false;
    for (const transfer of [...transaction.transfers].reverse()) this.locations.set(transfer.pieceId, transfer.from);
    this.turn = transaction.playerBefore;
    this.pending = null;
    return true;
  }

  get outcome(): Outcome {
    if (this.pending) return null;
    const alive = [false, false];
    for (const [id, location] of this.locations) {
      const piece = this.pieces.get(id)!;
      if (location.kind === "board" && this.pieceTypeOf(piece).royal) alive[piece.owner] = true;
    }
    if (!alive[0] && !alive[1]) return "draw";
    if (!alive[0]) return 1;
    if (!alive[1]) return 0;
    return null;
  }
}
