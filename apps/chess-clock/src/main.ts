type Mode = "fischer" | "byoyomi";
type ClockConfig = {
  mode: Mode;
  initialMs: number;
  incrementMs: number;
  byoyomiMs: number;
};
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
const pauseIcon = pauseButton.querySelector<SVGElement>("[data-pause-icon]")!;
const resumeIcon = pauseButton.querySelector<SVGElement>("[data-resume-icon]")!;
const settingsButton = document.querySelector<HTMLButtonElement>("[data-action=settings]")!;
const resetButton = document.querySelector<HTMLButtonElement>("[data-action=reset]")!;
const dialog = document.querySelector<HTMLDialogElement>("[data-settings]")!;
const form = document.querySelector<HTMLFormElement>("[data-settings-form]")!;
const separateInput = form.elements.namedItem("separate") as HTMLInputElement;
const separateSettings = document.querySelector<HTMLElement>("[data-separate-settings]")!;
const settingsSections = Array.from(document.querySelectorAll<HTMLElement>("[data-settings-player]"));

let configs: ClockConfig[] = [0, 1].map(() => ({ mode: "fischer", initialMs: 5 * 60_000, incrementMs: 3_000, byoyomiMs: 0 }));
let soundEnabled = true;
let vibrationEnabled = true;
let separateInitialized = false;
let players: Player[] = [];
let active: number | null = null;
let paused = false;
let expired: number | null = null;
let turnStartedAt = 0;
let animationId = 0;
let wakeLock: { release(): Promise<void> } | null = null;

function resetState(): void {
  players = configs.map((config) => ({
    mainMs: config.initialMs,
    byoMs: config.byoyomiMs,
    inByoyomi: config.initialMs === 0,
    moves: 0,
  }));
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
  const config = configs[index];
  if (config.mode === "fischer") player.mainMs += config.incrementMs;
  if (config.mode === "byoyomi" && player.inByoyomi) player.byoMs = config.byoyomiMs;
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
    const config = configs[index];
    const shownMs = value.inByoyomi ? value.byoMs : value.mainMs;
    timeElements[index].textContent = formatTime(shownMs);
    phaseElements[index].textContent = value.inByoyomi && config.mode === "byoyomi" && config.byoyomiMs > 0 ? "秒読み" : "持ち時間";
    moveElements[index].textContent = `${player.moves}手`;
    playerButtons.find((button) => Number(button.dataset.player) === index)?.classList.toggle("active", active === index && !paused);
    playerButtons.find((button) => Number(button.dataset.player) === index)?.classList.toggle("expired", expired === index);
  });
  pauseButton.disabled = active === null || expired !== null;
  pauseButton.ariaLabel = paused ? "再開" : "一時停止";
  pauseButton.title = paused ? "再開" : "一時停止";
  pauseIcon.classList.toggle("d-none", paused);
  resumeIcon.classList.toggle("d-none", !paused);
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

function sectionPrefix(section: HTMLElement): string {
  const player = section.dataset.settingsPlayer;
  return player === "shared" ? "shared" : `p${Number(player) + 1}`;
}

function sectionMode(section: HTMLElement): Mode {
  return section.querySelector<HTMLInputElement>(`input[name="${sectionPrefix(section)}-mode"]:checked`)!.value as Mode;
}

function updateSection(section: HTMLElement, enabled: boolean): void {
  const mode = sectionMode(section);
  section.querySelectorAll<HTMLInputElement>("input").forEach((input) => { input.disabled = !enabled; });
  const fischerFields = section.querySelector<HTMLElement>("[data-fischer]")!;
  const byoyomiFields = section.querySelector<HTMLElement>("[data-byoyomi]")!;
  fischerFields.hidden = mode !== "fischer";
  byoyomiFields.hidden = mode !== "byoyomi";
  fischerFields.querySelector<HTMLInputElement>("input")!.disabled = !enabled || mode !== "fischer";
  byoyomiFields.querySelector<HTMLInputElement>("input")!.disabled = !enabled || mode !== "byoyomi";
}

function copySharedSettings(): void {
  const shared = settingsSections.find((section) => section.dataset.settingsPlayer === "shared")!;
  const sourcePrefix = sectionPrefix(shared);
  for (const section of settingsSections.filter((item) => item !== shared)) {
    const targetPrefix = sectionPrefix(section);
    for (const field of ["minutes", "seconds", "increment", "byoyomi"]) {
      const source = form.elements.namedItem(`${sourcePrefix}-${field}`) as HTMLInputElement;
      const target = form.elements.namedItem(`${targetPrefix}-${field}`) as HTMLInputElement;
      target.value = source.value;
    }
    const mode = sectionMode(shared);
    (form.elements.namedItem(`${targetPrefix}-mode`) as RadioNodeList).value = mode;
  }
}

function updateSettingsVisibility(): void {
  const separate = separateInput.checked;
  if (separate && !separateInitialized) {
    copySharedSettings();
    separateInitialized = true;
  }
  separateSettings.classList.toggle("d-none", !separate);
  settingsSections.forEach((section) => {
    const isShared = section.dataset.settingsPlayer === "shared";
    section.classList.toggle("d-none", separate ? isShared : !isShared);
    updateSection(section, separate ? !isShared : isShared);
  });
}

function readConfig(section: HTMLElement): ClockConfig {
  const prefix = sectionPrefix(section);
  const value = (name: string): number => Number((form.elements.namedItem(`${prefix}-${name}`) as HTMLInputElement).value);
  const mode = sectionMode(section);
  return {
    mode,
    initialMs: (value("minutes") * 60 + value("seconds")) * 1000,
    incrementMs: mode === "fischer" ? value("increment") * 1000 : 0,
    byoyomiMs: mode === "byoyomi" ? value("byoyomi") * 1000 : 0,
  };
}

playerButtons.forEach((button) => button.addEventListener("click", () => pressPlayer(Number(button.dataset.player))));
pauseButton.addEventListener("click", togglePause);
resetButton.addEventListener("click", () => {
  if (active === null || confirm("時計をリセットしますか？")) resetState();
});
settingsButton.addEventListener("click", () => dialog.showModal());
form.addEventListener("change", (event) => {
  const target = event.target as HTMLInputElement;
  if (target === separateInput) updateSettingsVisibility();
  else if (target.name.endsWith("-mode")) updateSection(target.closest<HTMLElement>("[data-settings-player]")!, true);
});
document.querySelector<HTMLButtonElement>("[data-cancel]")!.addEventListener("click", () => dialog.close());
form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  const enabledSections = separateInput.checked
    ? settingsSections.filter((section) => section.dataset.settingsPlayer !== "shared")
    : [settingsSections.find((section) => section.dataset.settingsPlayer === "shared")!];
  const nextConfigs = enabledSections.map(readConfig);
  soundEnabled = data.get("sound") === "on";
  vibrationEnabled = data.get("vibration") === "on";
  const invalidPlayer = nextConfigs.findIndex((config) => config.initialMs === 0 && config.byoyomiMs === 0);
  if (invalidPlayer >= 0) {
    const label = separateInput.checked ? `PLAYER ${invalidPlayer + 1}の` : "";
    alert(`${label}持ち時間または秒読みを1秒以上に設定してください。`);
    return;
  }
  configs = separateInput.checked ? nextConfigs : [nextConfigs[0], { ...nextConfigs[0] }];
  dialog.close();
  resetState();
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && active !== null && !paused) void requestWakeLock();
});

updateSettingsVisibility();
resetState();
