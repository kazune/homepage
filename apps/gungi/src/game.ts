import { types, counts, movements, indexOf, positionOf, inside, other, type Player, type Piece, type PieceType, type Position } from "./pieces.js";
export type { Player, Piece, PieceType, Position } from "./pieces.js";
export type ActionKind = "place" | "move" | "capture" | "stack" | "betray";
export type Action = Readonly<{ pieceId: number; to: number; kind: ActionKind }>;
export type State = {
  board: Piece[][];
  hands: [Piece[], Piece[]];
  removed: Piece[];
  turn: Player;
  phase: "setup" | "play";
  done: [boolean, boolean];
  winner: Player | null;
  reason: string;
  moves: number;
  last: string;
};

function initialState(): State {
  let id = 1;
  const hand = (owner: Player): Piece[] => types.flatMap(type => Array.from({ length: counts[type] }, () => ({ id: id++, type, owner })));
  return { board: Array.from({ length: 81 }, () => []), hands: [hand(0), hand(1)], removed: [], turn: 0, phase: "setup", done: [false, false], winner: null, reason: "", moves: 0, last: "" };
}
function copy(state: State): State {
  return { ...state, board: state.board.map(tower => [...tower]), hands: [[...state.hands[0]], [...state.hands[1]]], removed: [...state.removed], done: [...state.done] };
}
export const coordinate = (index: number): string => { const [x, y] = positionOf(index); return `${9 - x}・${y + 1}`; };
export const actionName: Record<ActionKind, string> = { place: "配置", move: "移動", capture: "取る", stack: "ツケ", betray: "ツケ＋寝返り" };

export class GungiGame {
  state: State = initialState();
  readonly history: State[] = [];

  top(index: number): Piece | undefined { const tower = this.state.board[index]; return tower?.[tower.length - 1]; }
  locate(id: number): number { return this.state.board.findIndex(tower => tower.some(piece => piece.id === id)); }
  hasMarshal(owner: Player): boolean { return this.state.board.some(tower => tower.some(piece => piece.owner === owner && piece.type === "帥")); }

  private replacements(tower: readonly Piece[], mover: Piece): Piece[] | null {
    const available = this.state.hands[mover.owner].filter(piece => piece.id !== mover.id);
    const result: Piece[] = [];
    for (const enemy of tower.filter(piece => piece.owner !== mover.owner)) {
      const index = available.findIndex(piece => piece.type === enemy.type);
      if (index < 0) return null;
      result.push(available.splice(index, 1)[0]);
    }
    return result.length ? result : null;
  }

  actions(pieceId: number): Action[] {
    const { state } = this;
    if (state.winner !== null) return [];
    const from = this.locate(pieceId);
    const handPiece = state.hands[state.turn].find(piece => piece.id === pieceId);
    const piece = from >= 0 ? this.top(from) : handPiece;
    if (!piece || piece.id !== pieceId || piece.owner !== state.turn) return [];
    const result: Action[] = [];
    const add = (to: number, kind: ActionKind) => result.push({ pieceId, to, kind });

    if (state.phase === "setup") {
      if (!handPiece || state.done[state.turn] || (!this.hasMarshal(state.turn) && piece.type !== "帥")) return [];
      for (let to = 0; to < 81; to++) {
        const [, y] = positionOf(to);
        const tower = state.board[to];
        if ((state.turn === 0 ? y < 6 : y > 2) || tower.length >= 3 || this.top(to)?.type === "帥") continue;
        add(to, "place");
      }
      return result;
    }

    if (handPiece) {
      const visible = state.board.flatMap((_, index) => this.top(index)?.owner === state.turn ? [positionOf(index)[1]] : []);
      if (!visible.length) return [];
      const frontline = state.turn === 0 ? Math.min(...visible) : Math.max(...visible);
      for (let to = 0; to < 81; to++) {
        const [, y] = positionOf(to);
        if (state.turn === 0 ? y < frontline : y > frontline) continue;
        const tower = state.board[to];
        if (tower.length === 0) add(to, "place");
        else if (tower.length < 3 && this.top(to)?.type !== "帥" && (this.top(to)?.owner === state.turn || piece.type === "謀")) {
          add(to, "stack");
          if (piece.type === "謀" && this.replacements(tower, piece)) add(to, "betray");
        }
      }
      return result;
    }

    const tier = state.board[from].length;
    const [fx, fy] = positionOf(from);
    const orientation = state.turn === 0 ? 1 : -1;
    const destinations = new Set<number>();
    for (const movement of movements(piece.type, tier)) {
      const toPosition: Position = [fx + movement.offset[0] * orientation, fy + movement.offset[1] * orientation];
      if (!inside(toPosition)) continue;
      const blocked = movement.path.some(([dx, dy]) => {
        const tower = state.board[indexOf([fx + dx * orientation, fy + dy * orientation])];
        return movement.jump ? tower.length > tier : tower.length > 0;
      });
      if (!blocked) destinations.add(indexOf(toPosition));
    }
    for (const to of destinations) {
      const tower = state.board[to];
      const target = this.top(to);
      if (!target) { add(to, "move"); continue; }
      if (tower.length > tier) continue;
      if (target.owner !== state.turn) add(to, "capture");
      if (target.type === "帥") continue;
      // A third-tier enemy top may be replaced by a third-tier moving piece.
      if (tower.length < 3 || target.owner !== state.turn) {
        add(to, "stack");
        if (piece.type === "謀" && this.replacements(tower.length === 3 ? tower.slice(0, 2) : tower, piece)) add(to, "betray");
      }
    }
    return result;
  }

  apply(action: Action): void {
    if (!this.actions(action.pieceId).some(candidate => candidate.to === action.to && candidate.kind === action.kind)) throw new Error("その操作はできません");
    this.history.push(copy(this.state));
    const state = this.state;
    const from = this.locate(action.pieceId);
    const mover = from >= 0 ? state.board[from].pop()! : state.hands[state.turn].splice(state.hands[state.turn].findIndex(piece => piece.id === action.pieceId), 1)[0];
    let tower = state.board[action.to];
    if ((action.kind === "stack" || action.kind === "betray") && tower.length === 3) state.removed.push(tower.pop()!);
    if (action.kind === "capture") {
      state.removed.push(...tower.filter(piece => piece.owner !== mover.owner));
      tower = tower.filter(piece => piece.owner === mover.owner);
    } else if (action.kind === "betray") {
      const replacements = this.replacements(tower, mover)!;
      let n = 0;
      tower = tower.map(piece => {
        if (piece.owner === mover.owner) return piece;
        state.removed.push(piece);
        const replacement = replacements[n++];
        state.hands[mover.owner] = state.hands[mover.owner].filter(p => p.id !== replacement.id);
        return replacement;
      });
    }
    tower.push(mover);
    state.board[action.to] = tower;
    state.last = `${state.turn === 0 ? "先手" : "後手"}：${mover.type} ${from >= 0 ? coordinate(from) + " → " : ""}${coordinate(action.to)} ${actionName[action.kind]}`;
    if (state.phase === "setup") {
      if (state.hands[state.turn].length === 0) this.finishSetupState();
      else if (!state.done[other(state.turn)]) state.turn = other(state.turn);
    } else {
      state.moves++;
      if (!this.hasMarshal(other(state.turn))) { state.winner = state.turn; state.reason = "帥を捕獲しました。"; }
      state.turn = other(state.turn);
    }
  }

  get canFinishSetup(): boolean { return this.state.phase === "setup" && !this.state.done[this.state.turn] && this.hasMarshal(this.state.turn); }
  declareReady(): void {
    if (!this.canFinishSetup) throw new Error("帥を配置してください");
    this.history.push(copy(this.state));
    this.finishSetupState();
  }
  private finishSetupState(): void {
    const state = this.state;
    state.done[state.turn] = true;
    state.last = `${state.turn === 0 ? "先手" : "後手"}：済み`;
    if (state.turn === 1) { state.phase = "play"; state.turn = 0; }
    else state.turn = 1;
  }
  resign(): void {
    if (this.state.phase !== "play" || this.state.winner !== null) throw new Error("投了できません");
    this.history.push(copy(this.state));
    this.state.winner = other(this.state.turn);
    this.state.reason = `${this.state.turn === 0 ? "先手" : "後手"}が投了しました。`;
    this.state.last = this.state.reason;
  }
  undo(): boolean { const previous = this.history.pop(); if (!previous) return false; this.state = previous; return true; }
}
