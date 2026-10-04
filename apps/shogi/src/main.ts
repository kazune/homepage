import { Game, samePosition, type Piece, type Position } from "./game.js";

import { shogi } from "./games/shogi.js";
import { chuShogi } from "./games/chu-shogi.js";

function element<T extends HTMLElement>(id: string): T { return document.getElementById(id) as T; }
const board = element<HTMLDivElement>("board");
const undo = element<HTMLButtonElement>("undo");
const gameSelect = element<HTMLSelectElement>("game-select");
const initialDefinition = new URLSearchParams(window.location.search).get("game") === "chu" ? chuShogi : shogi;
let game = new Game(true, initialDefinition);
gameSelect.value = initialDefinition.id;
let selected: Piece | null = null;
let choices: readonly Position[] = [];
let promotionPiece: number | null = null;
let flipped = false;
const player = (owner: number) => owner === 0 ? "先手" : "後手";

function render(): void {
  const focusedSquare = document.activeElement instanceof HTMLElement ? document.activeElement.dataset.square : undefined;
  const result = game.outcome;
  const isChu = game.definition.id === "chu";
  document.querySelector("main")!.classList.toggle("chu", isChu);
  element("title").textContent = game.definition.title;
  document.title = `${game.definition.title} — 持ち駒・禁じ手なし`;
  element("shogi-rules").hidden = isChu;
  element("chu-rules").hidden = !isChu;
  board.style.setProperty("--columns", String(game.width));
  element("files").style.setProperty("--columns", String(game.width));
  const end = element<HTMLButtonElement>("end-turn");
  end.hidden = !game.activePiece || game.awaitingPromotion;
  end.disabled = !game.canEndTurn;
  element("turn").textContent = result === "draw" ? "引き分け" : result !== null ? `${player(result)}の勝ち` : `${player(game.turn)}の番`;
  element("count").textContent = `${game.history.length}手`;
  element("status").textContent = promotionPiece !== null ? "成る・成らないを選んで、この手を完了してください。"
    : result !== null ? "対局終了。「待った」で戻すか、「最初から」で再開できます。"
    : game.activePiece ? (choices.length === 0 && !game.canEndTurn ? "合法に移動を終了できません。「待った」で戻ってください。" : `${game.pieceTypeOf(game.activePiece).name}の${game.stage + 1}段目の移動先を選んでください。${game.canEndTurn ? "ここで手を終了することもできます。" : ""}`)
    : selected ? `${game.pieceTypeOf(selected).name}の移動先を選んでください。${choices.length === 0 ? "移動できるマスはありません。" : ""}`
    : "自分の駒を選ぶと移動先が表示されます。";
  element("promotion").hidden = promotionPiece === null;
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
    const coordinate = `${game.width - position[0]}${["一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二"][position[1]]}`;
    square.setAttribute("aria-label", `${coordinate} ${piece ? `${player(piece.owner)}の${game.definition.pieceTypes[piece.type].name}` : "空きマス"}${candidate ? "、移動可能" : ""}`);
    square.setAttribute("aria-pressed", String(piece?.id === selected?.id && !!piece));
    if (piece) {
      const glyph = document.createElement("span");
      const name = game.definition.pieceTypes[piece.type].name;
      glyph.className = "piece";
      glyph.classList.toggle("enemy", flipped ? piece.owner === 0 : piece.owner === 1);
      glyph.classList.toggle("promoted", !!game.pieceTypeOf(piece).promoted);
      glyph.classList.toggle("long", name.length > 1);
      glyph.textContent = name;
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
    const counts = new Map<string, number>();
    for (const transaction of [...game.history, ...(game.pending ? [game.pending] : [])]) {
      const mover = transaction.transfers.find(t => t.from.kind === "board" && t.to.kind === "board")?.pieceId;
      for (const transfer of transaction.transfers) {
        if (transfer.to.kind !== "void" || transfer.pieceId === mover) continue;
        const piece = game.pieces.get(transfer.pieceId)!;
        if (piece.owner === owner) counts.set(piece.type, (counts.get(piece.type) ?? 0) + 1);
      }
    }
    element(`lost-${owner}`).textContent = [...counts].map(([id, n]) => `${game.definition.pieceTypes[id].name}${n > 1 ? `×${n}` : ""}`).join("・") || "なし";
  }
}

function clearSelection(): void { selected = null; choices = []; }
function syncSelection(): void {
  if (game.activePiece && !game.awaitingPromotion) { selected = game.activePiece; choices = game.candidates(selected); }
  else clearSelection();
}
function clickSquare(position: Position): void {
  if (promotionPiece !== null || game.outcome !== null) return;
  if (selected && choices.some(p => samePosition(p, position))) {
    const id = selected.id;
    if (game.move(id, position)) promotionPiece = id;
    syncSelection();
    render();
    if (promotionPiece !== null) element("promote").focus();
    return;
  }
  if (game.activePiece) return;
  const piece = game.pieceAt(position);
  if (piece && piece.owner === game.turn && piece.id !== selected?.id) { selected = piece; choices = game.candidates(piece); }
  else clearSelection();
  render();
}
for (const [id, promote] of [["promote", true], ["stay", false]] as const) {
  element(id).addEventListener("click", () => {
    if (promotionPiece === null) return;
    game.completePromotion(promotionPiece, promote);
    promotionPiece = null;
    render();
    undo.focus();
  });
}
undo.addEventListener("click", () => { game.undo(); promotionPiece = null; clearSelection(); render(); });
element("end-turn").addEventListener("click", () => {
  const id = game.activePiece?.id;
  if (id === undefined || !game.canEndTurn) return;
  if (game.endTurn()) promotionPiece = id;
  syncSelection(); render();
  if (promotionPiece !== null) element("promote").focus();
});
element("flip").addEventListener("click", () => { flipped = !flipped; render(); });
element("reset").addEventListener("click", () => {
  if ((game.history.length || game.pending) && !window.confirm("対局を最初からやり直しますか？")) return;
  game = new Game(true, game.definition); promotionPiece = null; clearSelection(); render();
});
gameSelect.addEventListener("change", () => {
  if ((game.history.length || game.pending) && !window.confirm("対局を終了してゲームを切り替えますか？")) { gameSelect.value = game.definition.id; return; }
  game = new Game(true, gameSelect.value === "chu" ? chuShogi : shogi);
  promotionPiece = null; clearSelection();
  const url = new URL(window.location.href);
  if (game.definition.id === "chu") url.searchParams.set("game", "chu");
  else url.searchParams.delete("game");
  window.history.replaceState(null, "", url);
  render();
});
render();
