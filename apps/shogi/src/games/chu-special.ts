import type { Board, BoardState, Location, Piece, PieceType, Transaction, TurnValidationContext } from "../types.js";
import { samePosition } from "../rules.js";
import { evaluateMovements } from "../movement.js";

const isLion = (piece: Piece) => piece.type === "lion" || piece.type === "promoted-kirin";
function moverOf(transaction: Transaction, pieces: ReadonlyMap<number, Piece>): Piece | undefined {
  const transfer = transaction.transfers.find(t => t.from.kind === "board" && t.to.kind === "board");
  return transfer ? pieces.get(transfer.pieceId) : undefined;
}
function capturesOf(transaction: Transaction, pieces: ReadonlyMap<number, Piece>): Piece[] {
  // Promotion removes the old friendly piece too; it is not a capture.
  return transaction.transfers.filter(t => t.from.kind === "board" && t.to.kind === "void")
    .map(t => pieces.get(t.pieceId)!).filter(p => p.owner !== transaction.playerBefore);
}
function boardOf(state: BoardState, locations: ReadonlyMap<number, Location>): Board {
  return {
    width: state.width, height: state.height,
    pieceAt(position) {
      if (position[0] < 0 || position[1] < 0 || position[0] >= state.width || position[1] >= state.height) return undefined;
      for (const [id, location] of locations) {
        if (location.kind === "board" && samePosition(location.position, position)) return state.pieces.get(id)!;
      }
      return null;
    },
  };
}

function canCapture(state: BoardState, locations: ReadonlyMap<number, Location>, attacker: Piece,
  targetId: number, types: Readonly<Record<string, PieceType>>): boolean {
  const typeOf = (piece: Piece) => types[piece.type];
  for (const sequence of typeOf(attacker).sequences) {
    function search(stage: number, current: ReadonlyMap<number, Location>, captured: boolean): boolean {
      if (stage === sequence.stages.length) return captured;
      const from = current.get(attacker.id);
      if (from?.kind !== "board") return false;
      const landings = evaluateMovements(boardOf(state, current), attacker, from.position, sequence.stages[stage].movements, typeOf);
      for (const landing of landings) {
        const next = new Map(current);
        for (const effect of landing.effects) next.set(effect.pieceId, { kind: "void" });
        next.set(attacker.id, { kind: "board", position: landing.position });
        if (search(stage + 1, next, captured || landing.effects.some(e => e.pieceId === targetId))) return true;
      }
      return false;
    }
    if (search(0, locations, false)) return true;
  }
  return false;
}

// Test protection without calling validateTurn or legal-candidate filtering.
// Keep captured defenders on the turn-start board. Vacate the capturing
// piece's origin so a ranging defender behind it also counts (shadow support).
function hasSupport(state: BoardState, lion: Piece, mover: Piece, types: Readonly<Record<string, PieceType>>): boolean {
  const location = state.locations.get(lion.id);
  if (location?.kind !== "board") return false;
  const pieces = new Map(state.pieces);
  pieces.set(lion.id, { ...lion, owner: mover.owner });
  const hypothetical = { ...state, pieces };
  const locations = new Map(state.locations);
  locations.set(mover.id, { kind: "void" });
  for (const piece of state.pieces.values()) {
    if (piece.id !== lion.id && piece.owner === lion.owner && locations.get(piece.id)?.kind === "board" &&
      canCapture(hypothetical, locations, piece, lion.id, types)) return true;
  }
  return false;
}

// Supported lions cannot be taken by a distant lion, or immediately after
// a non-lion took a lion. Adjacent lion capture and tsukegui override both rules.
export function validateLionRules(context: TurnValidationContext, types: Readonly<Record<string, PieceType>>): string | null {
  const { before, transaction, previous } = context;
  const previousMover = previous ? moverOf(previous, before.pieces) : undefined;
  const senjishi = !!previous && previous.playerBefore !== transaction.playerBefore &&
    !!previousMover && !isLion(previousMover) && capturesOf(previous, before.pieces).some(isLion);
  const mover = moverOf(transaction, before.pieces);
  if (!mover || (!isLion(mover) && !senjishi)) return null;
  const origin = before.locations.get(mover.id);
  const captures = capturesOf(transaction, before.pieces);
  for (let index = 0; index < captures.length; index++) {
    const victim = captures[index];
    if (!isLion(victim)) continue;
    const location = before.locations.get(victim.id);
    if (isLion(mover) && origin?.kind === "board" && location?.kind === "board") {
      const distance = Math.max(Math.abs(origin.position[0] - location.position[0]), Math.abs(origin.position[1] - location.position[1]));
      if (distance <= 1) continue;
      const tsukegui = captures.slice(0, index).some(p => p.type !== "pawn" && p.type !== "go-between");
      if (tsukegui) continue;
    }
    if (hasSupport(before, victim, mover, types)) {
      return senjishi
        ? "先獅子違反：獅子以外の駒で獅子を取られた直後に、足のある相手の獅子を捕獲しました。"
        : "獅子の足の規則違反：足のある相手の獅子を、距離1の捕獲でも付け喰いでもない方法で獅子が捕獲しました。";
    }
  }
  return null;
}
