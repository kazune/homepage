import { GungiGame, actionName, coordinate, type Action, type Piece, type Player } from "./game.js";
import { types, names, movements, type PieceType } from "./pieces.js";

const element = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;
const playerName = (owner: Player): string => owner === 0 ? "先手" : "後手";
let game = new GungiGame();
let selected: number | null = null;
let actions: Action[] = [];
let target: number | null = null;
let inspected: number | null = null;
let flipped = false;
let helpType: PieceType = "帥";

function clearSelection(): void { selected = null; actions = []; target = null; }
function selectedPiece(): Piece | undefined {
  return [...game.state.board.flat(), ...game.state.hands.flat()].find(piece => piece.id === selected);
}
function selectPiece(piece: Piece): void {
  clearSelection(); selected = piece.id; actions = game.actions(piece.id); helpType = piece.type; render();
}
function describe(index: number): string {
  const tower = game.state.board[index];
  return `${coordinate(index)}：${tower.length ? tower.map((piece, i) => `${i + 1}段目 ${playerName(piece.owner)}の${piece.type}`).join("、") : "空きマス"}`;
}
function execute(action: Action): void {
  game.apply(action); clearSelection(); inspected = action.to; render();
  document.querySelector<HTMLButtonElement>(`[data-index="${action.to}"]`)?.focus({ preventScroll: true });
  if (game.state.winner !== null) window.alert(`${playerName(game.state.winner)}の勝ち。${game.state.reason}`);
}
function clickSquare(index: number): void {
  inspected = index;
  const choices = actions.filter(action => action.to === index);
  if (choices.length === 1) { execute(choices[0]); return; }
  if (choices.length > 1) {
    target = index; render(); element<HTMLButtonElement>("action-buttons").querySelector<HTMLButtonElement>("button")?.focus(); return;
  }
  const piece = game.top(index);
  if (game.state.phase === "play" && game.state.winner === null && piece?.owner === game.state.turn && piece.id !== selected) selectPiece(piece);
  else { clearSelection(); render(); }
}

function render(): void {
  const { state } = game;
  const focused = document.activeElement instanceof HTMLElement ? document.activeElement.dataset.focus : undefined;
  element("turn").textContent = state.winner !== null ? `${playerName(state.winner)}の勝ち` : `${playerName(state.turn)}の${state.phase === "setup" ? "配置" : "番"}`;
  element("phase").textContent = state.phase === "setup" ? "初期配置" : `${state.moves}手`;
  const piece = selectedPiece();
  element("status").textContent = state.winner !== null ? `${state.reason}「待った」で戻すか「最初から」で再開できます。`
    : target !== null ? "移動先への操作を選んでください。"
    : piece ? `${piece.type}の${state.phase === "setup" ? "配置先" : "移動先・新の置き先"}を選んでください。${actions.length ? "緑のマスを押せます。" : "置ける・動けるマスがありません。"}`
    : state.phase === "setup" ? `${game.hasMarshal(state.turn) ? "手駒を選んで、自陣の3行へ配置してください。" : "最初に手駒の帥を選び、自陣の3行へ置いてください。"}${state.done[0] ? "先手は配置済みです。" : ""}`
    : "自分の最上段の駒、または手駒を選んでください。";

  const layout = element("layout");
  const topHand = element(`hand-panel-${flipped ? 0 : 1}`);
  const bottomHand = element(`hand-panel-${flipped ? 1 : 0}`);
  layout.replaceChildren(topHand, element("board-wrap"), bottomHand);
  for (const owner of [0, 1] as const) {
    element(`hand-panel-${owner}`).classList.toggle("active", state.winner === null && state.turn === owner);
    element(`hand-title-${owner}`).textContent = `${playerName(owner)}の手駒（${state.hands[owner].length}枚）${state.phase === "setup" && state.done[owner] ? "・済み" : ""}`;
    const hand = element(`hand-${owner}`); hand.replaceChildren();
    for (const type of types) {
      const pieces = state.hands[owner].filter(piece => piece.type === type);
      if (!pieces.length) continue;
      const button = document.createElement("button"); button.type = "button"; button.dataset.focus = `hand-${owner}-${type}`; button.dataset.type = type;
      const symbol = document.createElement("span"); symbol.className = `symbol${owner === (flipped ? 0 : 1) ? " opponent" : ""}`; symbol.textContent = type;
      const count = document.createElement("span"); count.className = "count"; count.textContent = `×${pieces.length}`;
      button.append(symbol, count);
      button.disabled = state.winner !== null || owner !== state.turn || (state.phase === "setup" && !game.hasMarshal(owner) && type !== "帥");
      button.classList.toggle("selected", pieces.some(piece => piece.id === selected));
      button.setAttribute("aria-label", `${playerName(owner)}の${type}（${names[type]}）、${pieces.length}枚`);
      button.setAttribute("aria-pressed", String(pieces.some(piece => piece.id === selected)));
      button.addEventListener("click", () => { if (pieces.some(piece => piece.id === selected)) { clearSelection(); render(); } else selectPiece(pieces[0]); });
      hand.append(button);
    }
    if (!state.hands[owner].length) hand.textContent = "手駒なし";
  }

  const files = element("files"); files.replaceChildren();
  for (let x = 0; x < 9; x++) { const label = document.createElement("span"); label.textContent = String(flipped ? x + 1 : 9 - x); files.append(label); }
  const ranks = element("ranks"); ranks.replaceChildren();
  for (let y = 0; y < 9; y++) { const label = document.createElement("span"); label.textContent = String(flipped ? 9 - y : y + 1); ranks.append(label); }
  const board = element("board"); board.replaceChildren();
  const destinations = new Set(actions.map(action => action.to));
  for (let displayed = 0; displayed < 81; displayed++) {
    const index = flipped ? 80 - displayed : displayed;
    const tower = state.board[index];
    const top = game.top(index);
    const button = document.createElement("button"); button.type = "button"; button.className = "square"; button.dataset.index = String(index); button.dataset.focus = `square-${index}`;
    button.setAttribute("aria-label", `${describe(index)}${destinations.has(index) ? "、移動・配置候補" : ""}`);
    button.setAttribute("aria-pressed", String(top?.id === selected));
    button.classList.toggle("selected", top?.id === selected);
    button.classList.toggle("candidate", destinations.has(index));
    button.classList.toggle("target", target === index);
    button.classList.toggle("stacked", tower.length > 1);
    if (top) {
      const stone = document.createElement("span"); stone.className = `stone owner-${top.owner}`; stone.textContent = top.type;
      if (flipped) stone.style.transform = top.owner === 0 ? "rotate(180deg)" : "none";
      button.append(stone);
      if (tower.length > 1) {
        const under = document.createElement("span"); under.className = "under";
        for (const lower of tower.slice(0, -1)) { const label = document.createElement("span"); label.className = `owner-${lower.owner}`; label.textContent = lower.type; under.append(label); }
        button.append(under);
      }
    }
    button.addEventListener("click", () => clickSquare(index)); board.append(button);
  }
  const panel = element("action-panel"); panel.hidden = target === null;
  const buttons = element("action-buttons"); buttons.replaceChildren();
  if (target !== null) {
    element("action-title").textContent = `${coordinate(target)} への操作`;
    element("target-description").textContent = describe(target);
    for (const action of actions.filter(action => action.to === target)) {
      const button = document.createElement("button"); button.type = "button"; button.dataset.action = action.kind;
      const isHand = game.locate(action.pieceId) < 0;
      button.textContent = `${isHand ? "新＋" : ""}${actionName[action.kind]}${action.kind === "stack" && state.board[action.to].length === 3 ? "（最上段を取る）" : ""}`;
      button.addEventListener("click", () => execute(action)); buttons.append(button);
    }
    const cancel = document.createElement("button"); cancel.type = "button"; cancel.textContent = "キャンセル";
    cancel.addEventListener("click", () => { target = null; render(); }); buttons.append(cancel);
  }
  element("inspection").textContent = inspected === null ? "マスを選ぶと、下段の駒も確認できます。" : describe(inspected);
  element<HTMLButtonElement>("undo").disabled = !game.history.length;
  element("ready").hidden = state.phase !== "setup";
  element<HTMLButtonElement>("ready").disabled = !game.canFinishSetup;
  element("resign").hidden = state.phase !== "play" || state.winner !== null;
  element("last").textContent = state.last;
  renderHelp();
  if (focused) document.querySelector<HTMLElement>(`[data-focus="${focused}"]`)?.focus({ preventScroll: true });
}

function renderHelp(): void {
  element<HTMLSelectElement>("piece-help").value = helpType;
  const help = element("movement-help"); help.replaceChildren();
  const svgNS = "http://www.w3.org/2000/svg";
  for (let tier = 1; tier <= 3; tier++) {
    const figure = document.createElement("figure");
    const caption = document.createElement("figcaption"); caption.textContent = `${helpType} · ${tier}段`;
    const svg = document.createElementNS(svgNS, "svg"); svg.setAttribute("viewBox", "0 0 180 220"); svg.setAttribute("role", "img"); svg.setAttribute("aria-label", `${helpType}の${tier}段の移動範囲、上が前`);
    const options = movements(helpType, tier);
    for (let y = -5; y <= 5; y++) for (let x = -4; x <= 4; x++) {
      const rect = document.createElementNS(svgNS, "rect"); rect.setAttribute("x", String((x + 4) * 20)); rect.setAttribute("y", String((y + 5) * 20)); rect.setAttribute("width", "20"); rect.setAttribute("height", "20"); rect.setAttribute("stroke", "#d0d6cb");
      rect.setAttribute("fill", options.some(m => m.offset[0] === x && m.offset[1] === y) ? "#b9dbe0" : "#f8f9f5"); svg.append(rect);
      if (options.some(m => m.jump && m.offset[0] === x && m.offset[1] === y)) {
        const dot = document.createElementNS(svgNS, "circle"); dot.setAttribute("cx", String((x + 4) * 20 + 10)); dot.setAttribute("cy", String((y + 5) * 20 + 10)); dot.setAttribute("r", "3"); dot.setAttribute("fill", "#386951"); svg.append(dot);
      }
    }
    const text = document.createElementNS(svgNS, "text"); text.setAttribute("x", "90"); text.setAttribute("y", "115"); text.setAttribute("text-anchor", "middle"); text.setAttribute("font-size", "15"); text.textContent = helpType; svg.append(text);
    if (helpType === "大" || helpType === "中") {
      const directions = helpType === "大" ? [[0, -1], [0, 1], [-1, 0], [1, 0]] : [[-1, -1], [1, -1], [-1, 1], [1, 1]];
      for (const [dx, dy] of directions) {
        const arrow = document.createElementNS(svgNS, "text"); arrow.setAttribute("x", String(90 + dx * 75)); arrow.setAttribute("y", String(115 + dy * 75)); arrow.setAttribute("text-anchor", "middle"); arrow.setAttribute("fill", "#386951"); arrow.textContent = dx === 0 ? (dy < 0 ? "↑" : "↓") : dy === 0 ? (dx < 0 ? "←" : "→") : dx < 0 ? (dy < 0 ? "↖" : "↙") : (dy < 0 ? "↗" : "↘"); svg.append(arrow);
      }
    }
    figure.append(caption, svg); help.append(figure);
  }
}
for (const type of types) { const option = document.createElement("option"); option.value = type; option.textContent = `${type}（${names[type]}）`; element("piece-help").append(option); }
element("piece-help").addEventListener("change", () => { helpType = element<HTMLSelectElement>("piece-help").value as PieceType; renderHelp(); });
element("ready").addEventListener("click", () => { if (!window.confirm(`${playerName(game.state.turn)}の配置を終えますか？${game.state.turn === 1 ? "対局を開始します。" : "残りは手駒になります。"}`)) return; game.declareReady(); clearSelection(); render(); });
element("undo").addEventListener("click", () => { if (!window.confirm("本当に待ったをしますか？")) return; game.undo(); clearSelection(); render(); });
element("flip").addEventListener("click", () => { flipped = !flipped; render(); });
element("reset").addEventListener("click", () => { if (game.history.length && !window.confirm("対局を最初からやり直しますか？")) return; game = new GungiGame(); clearSelection(); inspected = null; render(); });
element("resign").addEventListener("click", () => { if (!window.confirm(`${playerName(game.state.turn)}が投了しますか？`)) return; game.resign(); clearSelection(); render(); window.alert(`${playerName(game.state.winner!)}の勝ち。${game.state.reason}`); });
render();
