import type { Piece, PlayerId, Position, Location, Transaction, SequenceRule, GameDefinition, PieceType, Outcome } from "./types.js";
import { samePosition } from "./rules.js";
import { evaluateMovements, type Landing } from "./movement.js";
import { shogi } from "./games/shogi.js";
export type * from "./types.js";
export { samePosition } from "./rules.js";
export { pieceTypes } from "./games/shogi.js";
const VOID: Location = { kind: "void" };
type Candidate = Landing & { sequences: SequenceRule[] };
type Progress = { pieceId: number; stage: number; sequences: readonly SequenceRule[]; path: Position[]; captured: boolean; promotion: boolean };

export class Game {
  readonly pieces = new Map<number, Piece>();
  readonly locations = new Map<number, Location>();
  readonly history: Transaction[] = [];
  turn: PlayerId = 0;
  pending: Transaction | null = null;
  private nextId = 1;
  private progress: Progress | null = null;
  private readonly violations = new WeakMap<Transaction, string>();

  constructor(initial = true, readonly definition: GameDefinition = shogi) {
    if (initial) for (const entry of definition.initial) this.addPiece(entry.type, entry.owner, entry.position);
  }
  get width(): number { return this.definition.width; }
  get height(): number { return this.definition.height; }
  get activePiece(): Piece | null { return this.progress ? this.pieces.get(this.progress.pieceId)! : null; }
  get stage(): number { return this.progress?.stage ?? 0; }
  get awaitingPromotion(): boolean { return this.progress?.promotion ?? false; }
  get canEndTurn(): boolean { return !!this.progress && !this.awaitingPromotion && this.progress.sequences.some(s => s.stages.length === this.stage); }

  addPiece(typeId: string, owner: PlayerId, position?: Position): Piece {
    if (!this.definition.pieceTypes[typeId]) throw new Error("未知の駒種です");
    if (position && (this.pieceAt(position) !== null)) throw new Error("駒を配置できません");
    const piece: Piece = { id: this.nextId++, type: typeId, owner };
    this.pieces.set(piece.id, piece);
    this.locations.set(piece.id, position ? { kind: "board", position } : VOID);
    return piece;
  }

  pieceTypeOf = (piece: Piece): PieceType => this.definition.pieceTypes[piece.type];

  pieceAt(position: Position): Piece | null | undefined {
    if (!position.every(Number.isInteger) || (position[0] < 0 || position[0] >= this.width || position[1] < 0 || position[1] >= this.height)) return undefined;
    for (const [id, location] of this.locations) {
      if (location.kind === "board" && samePosition(location.position, position)) return this.pieces.get(id)!;
    }
    return null;
  }

  private evaluate(piece: Piece): Map<string, Candidate> {
    const location = this.locations.get(piece.id);
    const candidates = new Map<string, Candidate>();
    if (location?.kind !== "board") return candidates;
    const from = location.position;
    const sequences = this.progress?.sequences ?? this.pieceTypeOf(piece).sequences;
    for (const sequence of sequences) {
      const stage = sequence.stages[this.stage];
      if (!stage) continue;
      for (const landing of evaluateMovements(this, piece, from, stage.movements, this.pieceTypeOf)) {
        const key = landing.position.join(",");
        const previous = candidates.get(key);
        const signature = (value: Landing) => JSON.stringify([...new Set(value.effects.map(e => e.pieceId))].sort((a, b) => a - b));
        if (previous && signature(previous) !== signature(landing)) throw new Error("同じ着地点の移動効果が異なります");
        candidates.set(key, { ...landing, sequences: [...new Set([...(previous?.sequences ?? []), sequence])] });
      }
    }
    return candidates;
  }

  candidates(piece: Piece): readonly Position[] {
    if (piece.owner !== this.turn || this.awaitingPromotion || (this.progress && this.progress.pieceId !== piece.id) || this.outcome !== null) return [];
    return [...this.evaluate(piece).values()].map(c => c.position);
  }

  canPromote(piece: Piece, from: Position, to: Position): boolean {
    return !!this.pieceTypeOf(piece).promoteTo && this.definition.canPromote({ piece, path: [from, to], captured: false });
  }

  private transfer(pieceId: number, to: Location): void {
    if (!this.pending) throw new Error("手が開始されていません");
    const from = this.locations.get(pieceId)!;
    this.locations.set(pieceId, to);
    this.pending = { ...this.pending, transfers: [...this.pending.transfers, { pieceId, from, to }] };
  }

  move(pieceId: number, to: Position): boolean {
    const piece = this.pieces.get(pieceId);
    if (!piece || piece.owner !== this.turn || this.awaitingPromotion || (this.progress && this.progress.pieceId !== pieceId) || this.outcome !== null) throw new Error("移動できません");
    const candidate = this.evaluate(piece).get(to.join(","));
    const from = this.locations.get(pieceId)!;
    if (!candidate || from.kind !== "board") throw new Error("移動できません");
    if (!this.pending) {
      this.pending = { playerBefore: this.turn, playerAfter: this.turn, transfers: [] };
      this.progress = { pieceId, stage: 0, sequences: [], path: [from.position], captured: false, promotion: false };
    }
    const progress = this.progress!;
    for (const effect of candidate.effects) this.transfer(effect.pieceId, VOID);
    this.transfer(pieceId, { kind: "board", position: to });
    progress.stage++;
    progress.sequences = candidate.sequences;
    progress.path.push(to);
    progress.captured ||= candidate.effects.length > 0;
    if (!progress.sequences.some(s => s.stages.length > progress.stage) && this.canEndTurn) this.endTurn();
    return this.awaitingPromotion;
  }

  endTurn(): boolean {
    if (!this.canEndTurn) throw new Error("合法に移動を終了できません");
    const progress = this.progress!;
    const piece = this.pieces.get(progress.pieceId)!;
    if (this.pieceTypeOf(piece).promoteTo && this.definition.canPromote({ piece, path: progress.path, captured: progress.captured })) {
      progress.promotion = true;
    } else this.finish();
    return this.awaitingPromotion;
  }

  completePromotion(pieceId: number, promote: boolean): void {
    const piece = this.pieces.get(pieceId);
    const location = this.locations.get(pieceId);
    if (!piece || !this.awaitingPromotion || this.progress?.pieceId !== pieceId || location?.kind !== "board") throw new Error("成りを選択できません");
    if (promote) {
      this.transfer(pieceId, VOID);
      const replacement = this.addPiece(this.pieceTypeOf(piece).promoteTo!, piece.owner);
      this.transfer(replacement.id, location);
    }
    this.finish();
  }

  private finish(): void {
    if (!this.pending) return;
    const after: PlayerId = this.turn === 0 ? 1 : 0;
    const transaction: Transaction = { ...this.pending, playerAfter: after };
    if (this.definition.validateTurn) {
      const beforeLocations = new Map(this.locations);
      for (const transfer of [...transaction.transfers].reverse()) beforeLocations.set(transfer.pieceId, transfer.from);
      const state = { width: this.width, height: this.height, pieces: this.pieces };
      const reason = this.definition.validateTurn({
        before: { ...state, locations: beforeLocations },
        after: { ...state, locations: this.locations },
        transaction, previous: this.history[this.history.length - 1],
      });
      if (reason) this.violations.set(transaction, reason);
    }
    this.history.push(transaction);
    this.turn = after;
    this.pending = null;
    this.progress = null;
  }

  undo(): boolean {
    const transaction = this.pending ?? this.history.pop();
    if (!transaction) return false;
    for (const transfer of [...transaction.transfers].reverse()) this.locations.set(transfer.pieceId, transfer.from);
    this.turn = transaction.playerBefore;
    this.pending = null;
    this.progress = null;
    return true;
  }

  get outcome(): Outcome {
    if (this.pending) return null;
    if (this.violation) return this.history[this.history.length - 1].playerAfter;
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

  get violation(): string | null {
    if (this.pending) return null;
    const last = this.history[this.history.length - 1];
    return last ? this.violations.get(last) ?? null : null;
  }
}
