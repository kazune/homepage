import { Game, samePosition, type Piece, type Position } from "./game.js";

import { shogi } from "./games/shogi.js";
import { dobutsuShogi } from "./games/dobutsu-shogi.js";
import { toriShogi } from "./games/tori-shogi.js";
import { chuShogi } from "./games/chu-shogi.js";
import { daiShogi } from "./games/dai-shogi.js";
import { taikyokuShogi } from "./games/taikyoku-shogi.js";

function element<T extends HTMLElement>(id: string): T { return document.getElementById(id) as T; }
const board = element<HTMLDivElement>("board");
const undo = element<HTMLButtonElement>("undo");
const gameSelect = element<HTMLSelectElement>("game-select");
const definitions = [shogi, dobutsuShogi, toriShogi, chuShogi, daiShogi, taikyokuShogi];
const initialDefinition = definitions.find(d => d.id === new URLSearchParams(window.location.search).get("game")) ?? shogi;
let game = new Game(true, initialDefinition);
gameSelect.value = initialDefinition.id;
let selected: Piece | null = null;
let choices: readonly Position[] = [];
let flipped = false;
let announcedNotice: string | null = null;
const player = (owner: number) => owner === 0 ? "先手" : "後手";
const rankName = (rank: number): string => {
  const digits = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
  const tens = Math.floor(rank / 10);
  return `${tens ? `${tens > 1 ? digits[tens] : ""}十` : ""}${digits[rank % 10]}`;
};

function render(): void {
  const focusedSquare = document.activeElement instanceof HTMLElement ? document.activeElement.dataset.square : undefined;
  const result = game.outcome;
  document.querySelector("main")!.classList.toggle("large-board", game.width > 9);
  document.querySelector("main")!.classList.toggle("dai", game.definition.id === "dai");
  document.querySelector("main")!.classList.toggle("taikyoku", game.definition.id === "taikyoku");
  document.querySelector("main")!.classList.toggle("dobutsu", game.definition.id === "dobutsu");
  element("title").textContent = game.definition.title;
  document.title = game.definition.title;
  const layout = element("board-layout");
  const topHand = element(`hand-panel-${flipped ? 0 : 1}`);
  const bottomHand = element(`hand-panel-${flipped ? 1 : 0}`);
  if (layout.firstElementChild !== topHand) {
    layout.insertBefore(topHand, element("board-wrap"));
    layout.append(bottomHand);
  }
  for (const definition of definitions) element(`${definition.id}-rules`).hidden = game.definition.id !== definition.id;
  board.style.setProperty("--columns", String(game.width));
  element("files").style.setProperty("--columns", String(game.width));
  const end = element<HTMLButtonElement>("end-turn");
  end.hidden = !game.activePiece || game.awaitingPromotion;
  end.disabled = !game.canEndTurn;
  element("turn").textContent = result === "draw" ? "引き分け" : result !== null ? `${player(result)}の勝ち` : `${player(game.turn)}の番`;
  element("count").textContent = `${game.history.length}手`;
  element("status").textContent = game.awaitingPromotion ? "確認ダイアログで成る・成らないを選んでください。"
    : game.violation ? `${game.violation}「待った」でこの手を取り消せます。`
    : result !== null ? "対局終了。「待った」で戻すか、「最初から」で再開できます。"
    : game.activePiece ? (choices.length === 0 && !game.canEndTurn ? "合法に移動を終了できません。「待った」で戻ってください。" : `${game.pieceTypeOf(game.activePiece).name}の${game.stage + 1}段目の移動先を選んでください。${game.canEndTurn ? "ここで手を終了することもできます。" : ""}`)
    : selected ? `${game.pieceTypeOf(selected).name}の${game.locations.get(selected.id)?.kind === "hand" ? "打ち先" : "移動先"}を選んでください。${choices.length === 0 ? "移動できるマスはありません。" : ""}`
    : "自分の駒を選ぶと移動先が表示されます。";
  undo.disabled = !game.pending && game.history.length === 0;
  const last = game.pending ?? game.history[game.history.length - 1];
  const lastSquares = last?.transfers.flatMap(t => [t.from, t.to]).filter(l => l.kind === "board") ?? [];
  board.replaceChildren();
  for (let row = 0; row < game.height; row++) for (let col = 0; col < game.width; col++) {
    const position: Position = flipped ? [game.width - 1 - col, game.height - 1 - row] : [col, row];
    const piece = game.pieceAt(position);
    const square = document.createElement("button");
    square.type = "button";
    square.className = "square";
    square.dataset.square = position.join(",");
    const candidate = choices.some(p => samePosition(p, position));
    square.classList.toggle("candidate", candidate);
    square.classList.toggle("selected", piece?.id === selected?.id && !!piece);
    square.classList.toggle("last", lastSquares.some(l => l.kind === "board" && samePosition(l.position, position)));
    const coordinate = `${game.width - position[0]}${rankName(position[1] + 1)}`;
    square.setAttribute("aria-label", `${coordinate} ${piece ? `${player(piece.owner)}の${game.definition.pieceTypes[piece.type].name}` : "空きマス"}${candidate ? "、移動可能" : ""}`);
    square.setAttribute("aria-pressed", String(piece?.id === selected?.id && !!piece));
    if (piece) {
      const glyph = document.createElement("span");
      const name = game.definition.pieceTypes[piece.type].name;
      glyph.className = "piece";
      glyph.classList.toggle("enemy", flipped ? piece.owner === 0 : piece.owner === 1);
      glyph.classList.toggle("promoted", !!game.pieceTypeOf(piece).promoted);
      glyph.classList.toggle("long", name.length > 1);
      glyph.classList.toggle("very-long", name.length > 3);
      glyph.textContent = name;
      if (game.definition.id === "dobutsu") {
        const animals: Record<string, string> = { lion: "🦁", elephant: "🐘", giraffe: "🦒", chick: "🐤", hen: "🐔" };
        const animal = document.createElement("span");
        animal.className = "animal";
        animal.setAttribute("aria-hidden", "true");
        animal.textContent = animals[piece.type];
        const label = document.createElement("span");
        label.textContent = name;
        glyph.replaceChildren(animal, label);
      }
      square.append(glyph);
    }
    square.addEventListener("click", () => clickSquare(position));
    board.append(square);
  }
  if (focusedSquare) board.querySelector<HTMLButtonElement>(`[data-square="${focusedSquare}"]`)?.focus();
  element("files").replaceChildren();
  for (let index = 0; index < game.width; index++) {
    const span = document.createElement("span");
    span.textContent = String(flipped ? index + 1 : game.width - index);
    element("files").append(span);
  }
  for (const owner of [0, 1]) {
    const panel = element(`hand-panel-${owner}`);
    panel.hidden = !game.definition.canDrop;
    panel.classList.toggle("active", owner === game.turn && result === null);
    const hand = element(`hand-${owner}`);
    hand.replaceChildren();
    const groups = new Map<string, Piece[]>();
    for (const piece of game.pieces.values()) {
      if (piece.owner === owner && game.locations.get(piece.id)?.kind === "hand") {
        groups.set(piece.type, [...groups.get(piece.type) ?? [], piece]);
      }
    }
    if (!groups.size) hand.textContent = "なし";
    for (const [type, pieces] of groups) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `${game.definition.pieceTypes[type].name} ×${pieces.length}`;
      button.disabled = owner !== game.turn || !!game.pending || result !== null;
      button.classList.toggle("selected", pieces.some(p => p.id === selected?.id));
      button.setAttribute("aria-pressed", String(pieces.some(p => p.id === selected?.id)));
      button.setAttribute("aria-label", `${player(owner)}の持ち駒 ${game.definition.pieceTypes[type].name} ${pieces.length}枚`);
      button.addEventListener("click", () => {
        if (pieces.some(p => p.id === selected?.id)) clearSelection();
        else { selected = pieces[0]; choices = game.candidates(selected); }
        render();
      });
      hand.append(button);
    }

  }
  const blocked = !!game.activePiece && choices.length === 0 && !game.canEndTurn;
  const notice = game.awaitingPromotion ? null
    : result !== null ? `${element("turn").textContent}\n${element("status").textContent}`
    : blocked ? element("status").textContent : null;
  if (notice !== announcedNotice) {
    announcedNotice = notice;
    if (notice) window.alert(notice);
  }
}

function clearSelection(): void { selected = null; choices = []; }
function syncSelection(): void {
  if (game.activePiece && !game.awaitingPromotion) { selected = game.activePiece; choices = game.candidates(selected); }
  else clearSelection();
}
function confirmPromotion(pieceId: number): void {
  clearSelection();
  render();
  const type = game.pieceTypeOf(game.pieces.get(pieceId)!);
  const promotedName = game.definition.pieceTypes[type.promoteTo!].name;
  game.completePromotion(pieceId, window.confirm(`「${type.name}」を成らせて「${promotedName}」にしますか？\nOK：成る／キャンセル：成らない`));
  undo.focus();
}
function clickSquare(position: Position): void {
  if (game.awaitingPromotion || game.outcome !== null) return;
  if (selected && choices.some(p => samePosition(p, position))) {
    const id = selected.id;
    if (game.locations.get(id)?.kind === "hand") game.drop(id, position);
    else if (game.move(id, position)) confirmPromotion(id);
    syncSelection();
    render();
    return;
  }
  if (game.activePiece) return;
  const piece = game.pieceAt(position);
  if (piece && piece.owner === game.turn && piece.id !== selected?.id) { selected = piece; choices = game.candidates(piece); }
  else clearSelection();
  render();
}
undo.addEventListener("click", () => { game.undo(); clearSelection(); render(); });
element("end-turn").addEventListener("click", () => {
  const id = game.activePiece?.id;
  if (id === undefined || !game.canEndTurn) return;
  if (game.endTurn()) confirmPromotion(id);
  syncSelection(); render();
});
element("flip").addEventListener("click", () => { flipped = !flipped; render(); });
element("reset").addEventListener("click", () => {
  if ((game.history.length || game.pending) && !window.confirm("対局を最初からやり直しますか？")) return;
  game = new Game(true, game.definition); clearSelection(); render();
});
gameSelect.addEventListener("change", () => {
  if ((game.history.length || game.pending) && !window.confirm("対局を終了してゲームを切り替えますか？")) { gameSelect.value = game.definition.id; return; }
  game = new Game(true, definitions.find(d => d.id === gameSelect.value) ?? shogi);
  clearSelection();
  const url = new URL(window.location.href);
  if (game.definition.id !== "shogi") url.searchParams.set("game", game.definition.id);
  else url.searchParams.delete("game");
  window.history.replaceState(null, "", url);
  render();
});
render();
