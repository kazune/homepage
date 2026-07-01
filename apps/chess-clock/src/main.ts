type Mode = "fischer" | "byoyomi";
type Player = {
  mainMs: number;
  byoMs: number;
  inByoyomi: boolean;
  moves: number;
};

const playerButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-player]"));
const timeElements = [0, 1].map((index) => document.querySelector<HTMLElement>(`[data-time="${index}"]`)!);
const phaseElements = [0, 1].map((index) => document.querySelector<HTMLElement>(`[data-phase="${index}"]`)!);
const moveElements = [0, 1].map((index) => document.querySelector<HTMLElement>(`[data-moves="${index}"]`)!);
const statusElement = document.querySelector<HTMLElement>("[data-status]")!;
const pauseButton = document.querySelector<HTMLButtonElement>("[data-action=pause]")!;
const settingsButton = document.querySelector<HTMLButtonElement>("[data-action=settings]")!;
const resetButton = document.querySelector<HTMLButtonElement>("[data-action=reset]")!;
const dialog = document.querySelector<HTMLDialogElement>("[data-settings]")!;
const form = document.querySelector<HTMLFormElement>("[data-settings-form]")!;
const fischerFields = document.querySelector<HTMLElement>("[data-fischer]")!;
const byoyomiFields = document.querySelector<HTMLElement>("[data-byoyomi]")!;
const incrementInput = form.elements.namedItem("increment") as HTMLInputElement;
const byoyomiInput = form.elements.namedItem("byoyomi") as HTMLInputElement;

let mode: Mode = "fischer";
let initialMs = 5 * 60_000;
let incrementMs = 3_000;
let byoyomiMs = 10_000;
let soundEnabled = true;
let vibrationEnabled = true;
let players: Player[] = [];
let active: number | null = null;
let paused = false;
let expired: number | null = null;
let turnStartedAt = 0;
let animationId = 0;
let wakeLock: { release(): Promise<void> } | null = null;

function resetState(): void {
  players = [0, 1].map(() => ({ mainMs: initialMs, byoMs: byoyomiMs, inByoyomi: initialMs === 0, moves: 0 }));
  active = null;
  paused = false;
  expired = null;
  cancelAnimationFrame(animationId);
  releaseWakeLock();
  render();
}

function currentValues(index: number, now = performance.now()): { mainMs: number; byoMs: number; inByoyomi: boolean } {
  const player = players[index];
  let mainMs = player.mainMs;
  let byoMs = player.byoMs;
  let inByoyomi = player.inByoyomi;
  if (active !== index || paused || expired !== null) return { mainMs, byoMs, inByoyomi };
  let elapsed = now - turnStartedAt;
  if (!inByoyomi) {
    const used = Math.min(mainMs, elapsed);
    mainMs -= used;
    elapsed -= used;
    if (mainMs <= 0) inByoyomi = true;
  }
  if (inByoyomi) byoMs = Math.max(0, byoMs - elapsed);
  return { mainMs, byoMs, inByoyomi };
}

function settle(now = performance.now()): void {
  if (active === null || paused || expired !== null) return;
  Object.assign(players[active], currentValues(active, now));
  turnStartedAt = now;
}

function pressPlayer(index: number): void {
  if (expired !== null) return;
  const now = performance.now();
  if (active === null) {
    active = index === 0 ? 1 : 0;
    paused = false;
    turnStartedAt = now;
    void requestWakeLock();
    tick();
    return;
  }
  if (paused || active !== index) return;
  settle(now);
  const player = players[index];
  if (mode === "fischer") player.mainMs += incrementMs;
  if (mode === "byoyomi" && player.inByoyomi) player.byoMs = byoyomiMs;
  player.moves += 1;
  active = index === 0 ? 1 : 0;
  turnStartedAt = now;
  beep(540, 0.035);
  render(now);
}

function tick(): void {
  cancelAnimationFrame(animationId);
  const now = performance.now();
  if (active !== null && !paused && expired === null) {
    const value = currentValues(active, now);
    if (value.inByoyomi && value.byoMs <= 0) {
      Object.assign(players[active], value);
      expired = active;
      paused = true;
      alarm();
      void releaseWakeLock();
    }
  }
  render(now);
  if (active !== null && !paused && expired === null) animationId = requestAnimationFrame(tick);
}

function formatTime(ms: number): string {
  const safe = Math.max(0, ms);
  if (safe < 60_000) {
    const seconds = Math.floor(safe / 1000);
    const tenths = Math.floor((safe % 1000) / 100);
    return `${String(seconds).padStart(2, "0")}.${tenths}`;
  }
  const totalSeconds = Math.ceil(safe / 1000);
  return `${String(Math.floor(totalSeconds / 60)).padStart(2, "0")}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

function render(now = performance.now()): void {
  players.forEach((player, index) => {
    const value = currentValues(index, now);
    const shownMs = value.inByoyomi ? value.byoMs : value.mainMs;
    timeElements[index].textContent = formatTime(shownMs);
    phaseElements[index].textContent = value.inByoyomi && mode === "byoyomi" && byoyomiMs > 0 ? "秒読み" : "持ち時間";
    moveElements[index].textContent = `${player.moves}手`;
    playerButtons.find((button) => Number(button.dataset.player) === index)?.classList.toggle("active", active === index && !paused);
    playerButtons.find((button) => Number(button.dataset.player) === index)?.classList.toggle("expired", expired === index);
  });
  pauseButton.disabled = active === null || expired !== null;
  pauseButton.textContent = paused ? "再開" : "一時停止";
  settingsButton.disabled = active !== null && !paused;
  if (expired !== null) statusElement.textContent = `PLAYER ${expired + 1} 時間切れ`;
  else if (active === null) statusElement.textContent = "時計をタップして相手側を開始";
  else if (paused) statusElement.textContent = "一時停止中";
  else statusElement.textContent = `PLAYER ${active + 1} の手番`;
}

function togglePause(): void {
  if (active === null || expired !== null) return;
  if (paused) {
    paused = false;
    turnStartedAt = performance.now();
    void requestWakeLock();
    tick();
  } else {
    settle();
    paused = true;
    cancelAnimationFrame(animationId);
    void releaseWakeLock();
    render();
  }
}

function beep(frequency: number, duration: number): void {
  if (!soundEnabled) return;
  try {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.08, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
    oscillator.addEventListener("ended", () => void context.close());
  } catch { /* Audio is optional. */ }
}

function alarm(): void {
  beep(190, 0.7);
  if (vibrationEnabled && "vibrate" in navigator) navigator.vibrate([250, 100, 500]);
}

async function requestWakeLock(): Promise<void> {
  try {
    const nav = navigator as Navigator & { wakeLock?: { request(type: "screen"): Promise<{ release(): Promise<void> }> } };
    if (nav.wakeLock && document.visibilityState === "visible") wakeLock = await nav.wakeLock.request("screen");
  } catch { wakeLock = null; }
}

async function releaseWakeLock(): Promise<void> {
  if (!wakeLock) return;
  await wakeLock.release().catch(() => undefined);
  wakeLock = null;
}

function selectedMode(): Mode {
  return new FormData(form).get("mode") === "byoyomi" ? "byoyomi" : "fischer";
}

function updateModeFields(): void {
  const nextMode = selectedMode();
  fischerFields.hidden = nextMode !== "fischer";
  byoyomiFields.hidden = nextMode !== "byoyomi";
  incrementInput.disabled = nextMode !== "fischer";
  byoyomiInput.disabled = nextMode !== "byoyomi";
}

playerButtons.forEach((button) => button.addEventListener("click", () => pressPlayer(Number(button.dataset.player))));
pauseButton.addEventListener("click", togglePause);
resetButton.addEventListener("click", () => {
  if (active === null || confirm("時計をリセットしますか？")) resetState();
});
settingsButton.addEventListener("click", () => dialog.showModal());
form.addEventListener("change", (event) => {
  if ((event.target as HTMLInputElement).name === "mode") updateModeFields();
});
document.querySelector<HTMLButtonElement>("[data-cancel]")!.addEventListener("click", () => dialog.close());
form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  const minutes = Number(data.get("minutes"));
  const seconds = Number(data.get("seconds"));
  initialMs = (minutes * 60 + seconds) * 1000;
  mode = selectedMode();
  incrementMs = Number(data.get("increment")) * 1000;
  byoyomiMs = mode === "byoyomi" ? Number(data.get("byoyomi")) * 1000 : 0;
  soundEnabled = data.get("sound") === "on";
  vibrationEnabled = data.get("vibration") === "on";
  if (initialMs === 0 && (mode !== "byoyomi" || byoyomiMs === 0)) {
    alert("持ち時間または秒読みを1秒以上に設定してください。");
    return;
  }
  dialog.close();
  resetState();
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && active !== null && !paused) void requestWakeLock();
});

updateModeFields();
resetState();
