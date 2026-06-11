type Weapon = {
  id: string;
  number: number;
  name: {
    en: string;
    ja: string;
  };
  class: {
    id: string;
    en: string;
    ja: string;
    displayEn: string;
  };
  sub: {
    id: string;
    en: string;
    ja: string;
  };
  special: {
    id: string;
    en: string;
    ja: string;
  };
  specialPoints: number;
  unlockLevel: number;
  introduced: {
    version: string;
    season: string;
  };
};

type WeaponsData = {
  summary: {
    weaponKitCount: number;
    gameVersion: string;
  };
  weapons: Weapon[];
};

type WeaponClassOrderData = {
  order: Array<{
    id: string;
  }>;
};

type WeaponProgress = {
  wins: number;
  losses: number;
  updatedAt?: string;
};

type Progress = {
  version: 1;
  targetWins: number;
  weapons: Record<string, WeaponProgress>;
};

type StatusFilter = "all" | "complete" | "incomplete";
type SortMode = "default" | "wins" | "losses";

const storageKey = "splatoon3-weapon-challenge:v1";
const defaultProgress: Progress = {
  version: 1,
  targetWins: 1,
  weapons: {},
};

let weapons: Weapon[] = [];
let weaponClassOrder = new Map<string, number>();
let progress: Progress = loadProgress();
let gameVersion = "";
let searchText = "";
let classFilter = "all";
let statusFilter: StatusFilter = "incomplete";
let sortMode: SortMode = "default";
let selectedWeaponId: string | null = null;

const targetWinsInput = query<HTMLInputElement>("[data-target-wins]");
const challengeTitleElement = query("[data-challenge-title]");
const completeSummaryElement = query("[data-complete-summary]");
const recordSummaryElement = query("[data-record-summary]");
const searchInput = query<HTMLInputElement>("[data-search]");
const classFilterSelect = query<HTMLSelectElement>("[data-class-filter]");
const statusFilterSelect = query<HTMLSelectElement>("[data-status-filter]");
const sortSelect = query<HTMLSelectElement>("[data-sort]");
const randomButton = query<HTMLButtonElement>("[data-random]");
const selectedEmptyElement = query<HTMLElement>("[data-selected-empty]");
const selectedDetailElement = query<HTMLElement>("[data-selected-detail]");
const selectedStatusElement = query("[data-selected-status]");
const selectedNameElement = query("[data-selected-name]");
const selectedRecordElement = query("[data-selected-record]");
const selectedActionsElement = query("[data-selected-actions]");
const visibleCountElement = query("[data-visible-count]");
const messageElement = query("[data-message]");
const listElement = query("[data-list]");
const exportButton = query<HTMLButtonElement>("[data-export]");
const importInput = query<HTMLInputElement>("[data-import]");
const resetButton = query<HTMLButtonElement>("[data-reset]");

function query<T extends HTMLElement = HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);

  if (!element) {
    throw new Error(`Missing element: ${selector}`);
  }

  return element;
}

function loadProgress(): Progress {
  const rawValue = localStorage.getItem(storageKey);

  if (!rawValue) {
    return structuredClone(defaultProgress);
  }

  try {
    const value = JSON.parse(rawValue) as Partial<Progress>;

    if (value.version !== 1 || typeof value.weapons !== "object" || value.weapons === null) {
      return structuredClone(defaultProgress);
    }

    return {
      version: 1,
      targetWins: normalizePositiveInteger(value.targetWins, 1),
      weapons: sanitizeWeaponsProgress(value.weapons),
    };
  } catch {
    return structuredClone(defaultProgress);
  }
}

function sanitizeWeaponsProgress(value: Record<string, unknown>): Record<string, WeaponProgress> {
  const result: Record<string, WeaponProgress> = {};

  for (const [weaponId, rawProgress] of Object.entries(value)) {
    if (!rawProgress || typeof rawProgress !== "object") {
      continue;
    }

    const item = rawProgress as Partial<WeaponProgress>;
    const wins = normalizeNonNegativeInteger(item.wins, 0);
    const losses = normalizeNonNegativeInteger(item.losses, 0);

    if (wins === 0 && losses === 0) {
      continue;
    }

    result[weaponId] = {
      wins,
      losses,
      updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : undefined,
    };
  }

  return result;
}

function saveProgress() {
  localStorage.setItem(storageKey, JSON.stringify(progress));
}

function normalizePositiveInteger(value: unknown, fallback: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(1, Math.floor(parsed));
}

function normalizeNonNegativeInteger(value: unknown, fallback: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(0, Math.floor(parsed));
}

function getWeaponProgress(weaponId: string): WeaponProgress {
  return progress.weapons[weaponId] ?? { wins: 0, losses: 0 };
}

function setWeaponProgress(weaponId: string, nextProgress: WeaponProgress) {
  const wins = Math.max(0, Math.floor(nextProgress.wins));
  const losses = Math.max(0, Math.floor(nextProgress.losses));

  if (wins === 0 && losses === 0) {
    delete progress.weapons[weaponId];
  } else {
    progress.weapons[weaponId] = {
      wins,
      losses,
      updatedAt: new Date().toISOString(),
    };
  }

  saveProgress();
  render();
}

function adjustWeaponProgress(weaponId: string, winsDelta: number, lossesDelta: number) {
  const item = getWeaponProgress(weaponId);
  const wins = Math.max(0, item.wins + winsDelta);
  const losses = Math.max(0, item.losses + lossesDelta);

  if (wins === item.wins && losses === item.losses) {
    return;
  }

  setWeaponProgress(weaponId, { wins, losses });
}

function adjustSelectedWeaponProgress(winsDelta: number, lossesDelta: number) {
  const weapon = getSelectedWeapon();

  if (!weapon) {
    return;
  }

  adjustWeaponProgress(weapon.id, winsDelta, lossesDelta);
}

function isComplete(weaponId: string) {
  return getWeaponProgress(weaponId).wins >= progress.targetWins;
}

function matchesStatusFilter(weapon: Weapon) {
  const item = getWeaponProgress(weapon.id);

  if (statusFilter === "all") {
    return true;
  }

  if (statusFilter === "complete") {
    return item.wins >= progress.targetWins;
  }

  return item.wins < progress.targetWins;
}

function matchesSearchText(weapon: Weapon) {
  if (!searchText) {
    return true;
  }

  const haystack = [
    weapon.name.ja,
    weapon.name.en,
    weapon.class.ja,
    weapon.class.en,
    weapon.sub.ja,
    weapon.sub.en,
    weapon.special.ja,
    weapon.special.en,
  ]
    .join(" ")
    .toLocaleLowerCase();

  return haystack.includes(searchText);
}

function getVisibleWeapons() {
  const visibleWeapons = weapons.filter((weapon) => {
    const classMatches = classFilter === "all" || weapon.class.id === classFilter;

    return classMatches && matchesStatusFilter(weapon) && matchesSearchText(weapon);
  });

  return sortWeapons(visibleWeapons);
}

function sortWeapons(items: Weapon[]) {
  if (sortMode === "wins") {
    return items.slice().sort((a, b) => {
      const winsDelta = getWeaponProgress(b.id).wins - getWeaponProgress(a.id).wins;

      return winsDelta || compareByDefaultOrder(a, b);
    });
  }

  if (sortMode === "losses") {
    return items.slice().sort((a, b) => {
      const lossesDelta = getWeaponProgress(b.id).losses - getWeaponProgress(a.id).losses;

      return lossesDelta || compareByDefaultOrder(a, b);
    });
  }

  return items.slice().sort(compareByDefaultOrder);
}

function compareByDefaultOrder(a: Weapon, b: Weapon) {
  const classOrderDelta = getClassOrder(a.class.id) - getClassOrder(b.class.id);

  return classOrderDelta || a.number - b.number;
}

function getClassOrder(classId: string) {
  return weaponClassOrder.get(classId) ?? Number.MAX_SAFE_INTEGER;
}

function getSelectedWeapon() {
  if (!selectedWeaponId) {
    return null;
  }

  return weapons.find((weapon) => weapon.id === selectedWeaponId) ?? null;
}

function selectWeapon(weaponId: string) {
  selectedWeaponId = weaponId;
  render();
}

function ensureSelectedWeapon() {
  if (getSelectedWeapon()) {
    return;
  }

  const firstIncomplete = weapons.find((weapon) => !isComplete(weapon.id));
  selectedWeaponId = firstIncomplete?.id ?? weapons[0]?.id ?? null;
}

function calculateTotals() {
  const completeCount = weapons.filter((weapon) => isComplete(weapon.id)).length;
  let totalWins = 0;
  let totalLosses = 0;

  for (const weapon of weapons) {
    const item = getWeaponProgress(weapon.id);
    totalWins += item.wins;
    totalLosses += item.losses;
  }

  return {
    completeCount,
    totalWins,
    totalLosses,
  };
}

function renderSummary() {
  const totals = calculateTotals();

  challengeTitleElement.textContent = `全ブキ${progress.targetWins}勝チャレンジ`;
  completeSummaryElement.textContent = `${totals.completeCount} / ${weapons.length} 達成`;
  recordSummaryElement.textContent = `${totals.totalWins}勝 ${totals.totalLosses}負`;
}

function renderClassOptions() {
  const classes = new Map<string, string>();

  for (const weapon of weapons) {
    classes.set(weapon.class.id, weapon.class.ja);
  }

  for (const [id, label] of classes) {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = label;
    classFilterSelect.append(option);
  }
}

function renderList() {
  const visibleWeapons = getVisibleWeapons();
  const fragment = document.createDocumentFragment();

  listElement.textContent = "";
  visibleCountElement.textContent = `${visibleWeapons.length}件`;
  messageElement.textContent = `データ: ${weapons.length}ブキ / v${gameVersion}`;

  if (visibleWeapons.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "条件に合うブキがありません。";
    listElement.append(empty);
    return;
  }

  for (const weapon of visibleWeapons) {
    fragment.append(createWeaponRow(weapon));
  }

  listElement.append(fragment);
}

function renderSelectedWeapon() {
  ensureSelectedWeapon();

  const weapon = getSelectedWeapon();

  if (!weapon) {
    selectedEmptyElement.hidden = false;
    selectedDetailElement.hidden = true;
    selectedActionsElement.textContent = "";
    return;
  }

  const item = getWeaponProgress(weapon.id);
  const complete = item.wins >= progress.targetWins;

  selectedEmptyElement.hidden = true;
  selectedDetailElement.hidden = false;
  selectedStatusElement.className = `status ${complete ? "complete" : "incomplete"}`;
  selectedStatusElement.textContent = complete ? "達成済み" : "未達成";
  selectedNameElement.textContent = weapon.name.ja;
  selectedRecordElement.textContent = `${item.wins}勝 ${item.losses}負`;
  selectedActionsElement.textContent = "";
  selectedActionsElement.append(
    createActionButton("+勝ち", "win", () => {
      adjustWeaponProgress(weapon.id, 1, 0);
    }),
    createActionButton("+負け", "loss", () => {
      adjustWeaponProgress(weapon.id, 0, 1);
    }),
    createActionButton("-勝ち", "small", () => {
      adjustWeaponProgress(weapon.id, -1, 0);
    }, item.wins <= 0),
    createActionButton("-負け", "small", () => {
      adjustWeaponProgress(weapon.id, 0, -1);
    }, item.losses <= 0),
  );
}

function createWeaponRow(weapon: Weapon) {
  const item = getWeaponProgress(weapon.id);
  const complete = item.wins >= progress.targetWins;
  const row = document.createElement("button");
  row.type = "button";
  row.className = [
    "weapon-row",
    complete ? "is-complete" : "",
    weapon.id === selectedWeaponId ? "is-selected" : "",
  ]
    .filter(Boolean)
    .join(" ");
  row.addEventListener("click", () => {
    selectWeapon(weapon.id);
  });

  const name = document.createElement("span");
  name.className = "weapon-row-name";
  name.textContent = weapon.name.ja;

  const record = document.createElement("span");
  record.className = "weapon-row-record";
  record.textContent = `${item.wins}勝 / ${item.losses}敗`;

  const status = document.createElement("span");
  status.className = `weapon-row-status ${complete ? "complete" : "incomplete"}`;
  status.textContent = complete ? "済" : "未達";

  row.append(name, record, status);

  return row;
}

function createActionButton(
  label: string,
  className: string,
  onClick: () => void,
  disabled = false,
) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = label;
  button.disabled = disabled;
  button.addEventListener("click", onClick);

  return button;
}

function render() {
  renderSummary();
  renderSelectedWeapon();
  renderList();
}

async function loadWeapons() {
  const [weaponsResponse, classOrderResponse] = await Promise.all([
    fetch("./data/weapons.json"),
    fetch("./data/weapon-class-order.json"),
  ]);

  if (!weaponsResponse.ok) {
    throw new Error(`Failed to load weapons: ${weaponsResponse.status}`);
  }

  if (!classOrderResponse.ok) {
    throw new Error(`Failed to load weapon class order: ${classOrderResponse.status}`);
  }

  const data = (await weaponsResponse.json()) as WeaponsData;
  const classOrderData = (await classOrderResponse.json()) as WeaponClassOrderData;
  weaponClassOrder = new Map(classOrderData.order.map((item, index) => [item.id, index]));
  weapons = data.weapons.slice().sort(compareByDefaultOrder);
  gameVersion = data.summary.gameVersion;
  renderClassOptions();
  render();
}

function pickRandomIncompleteWeapon() {
  const candidates = weapons.filter((weapon) => !isComplete(weapon.id));

  if (candidates.length === 0) {
    messageElement.textContent = "全ブキ達成済みです。";
    return;
  }

  const weapon = candidates[Math.floor(Math.random() * candidates.length)];
  selectWeapon(weapon.id);
  messageElement.textContent = `${weapon.name.ja} を選択しました。`;
}

function selectFirstVisibleWeapon() {
  const weapon = getVisibleWeapons()[0];

  if (!weapon) {
    messageElement.textContent = "表示中のブキがありません。";
    return;
  }

  selectWeapon(weapon.id);
  messageElement.textContent = `${weapon.name.ja} を選択しました。`;
}

function selectAdjacentVisibleWeapon(direction: 1 | -1) {
  const visibleWeapons = getVisibleWeapons();

  if (visibleWeapons.length === 0) {
    messageElement.textContent = "表示中のブキがありません。";
    return;
  }

  const currentIndex = selectedWeaponId
    ? visibleWeapons.findIndex((weapon) => weapon.id === selectedWeaponId)
    : -1;
  const nextIndex =
    currentIndex === -1
      ? direction === 1
        ? 0
        : visibleWeapons.length - 1
      : Math.min(visibleWeapons.length - 1, Math.max(0, currentIndex + direction));
  const weapon = visibleWeapons[nextIndex];

  selectWeapon(weapon.id);
  messageElement.textContent = `${weapon.name.ja} を選択しました。`;
}

function resetListControls() {
  searchText = "";
  classFilter = "all";
  statusFilter = "incomplete";
  sortMode = "default";
  searchInput.value = "";
  classFilterSelect.value = classFilter;
  statusFilterSelect.value = statusFilter;
  sortSelect.value = sortMode;
}

function isKeyboardShortcutDisabled(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(target.closest("input, select, textarea, [contenteditable='true']"));
}

function handleKeyboardShortcut(event: KeyboardEvent) {
  if (event.key === "Escape") {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    return;
  }

  if (isKeyboardShortcutDisabled(event.target)) {
    return;
  }

  if (event.key === "w") {
    adjustSelectedWeaponProgress(1, 0);
    return;
  }

  if (event.key === "l") {
    adjustSelectedWeaponProgress(0, 1);
    return;
  }

  if (event.key === "W") {
    adjustSelectedWeaponProgress(-1, 0);
    return;
  }

  if (event.key === "L") {
    adjustSelectedWeaponProgress(0, -1);
    return;
  }

  if (event.key === "r" || event.key === "R") {
    pickRandomIncompleteWeapon();
    return;
  }

  if (event.key === "n" || event.key === "N") {
    selectFirstVisibleWeapon();
    return;
  }

  if (event.key === "j" || event.key === "J") {
    selectAdjacentVisibleWeapon(1);
    return;
  }

  if (event.key === "k" || event.key === "K") {
    selectAdjacentVisibleWeapon(-1);
    return;
  }

  if (event.key === "/") {
    event.preventDefault();
    searchInput.focus();
  }
}

function exportProgress() {
  const payload = JSON.stringify(progress, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `splatoon-weapon-challenge-${formatDateForFilename(new Date())}.json`;
  link.click();
  URL.revokeObjectURL(url);
  messageElement.textContent = "進捗JSONをダウンロードしました。";
}

function formatDateForFilename(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}${month}${day}`;
}

async function importProgress(file: File) {
  const value = JSON.parse(await file.text()) as Partial<Progress>;

  if (value.version !== 1 || typeof value.weapons !== "object" || value.weapons === null) {
    throw new Error("Invalid progress file");
  }

  progress = {
    version: 1,
    targetWins: normalizePositiveInteger(value.targetWins, progress.targetWins),
    weapons: sanitizeWeaponsProgress(value.weapons),
  };
  targetWinsInput.value = String(progress.targetWins);
  saveProgress();
  render();
}

targetWinsInput.value = String(progress.targetWins);

targetWinsInput.addEventListener("change", () => {
  progress.targetWins = normalizePositiveInteger(targetWinsInput.value, 1);
  targetWinsInput.value = String(progress.targetWins);
  saveProgress();
  render();
});

searchInput.addEventListener("input", () => {
  searchText = searchInput.value.trim().toLocaleLowerCase();
  renderList();
});

classFilterSelect.addEventListener("change", () => {
  classFilter = classFilterSelect.value;
  renderList();
});

statusFilterSelect.addEventListener("change", () => {
  statusFilter = statusFilterSelect.value as StatusFilter;
  renderList();
});

sortSelect.addEventListener("change", () => {
  sortMode = sortSelect.value as SortMode;
  renderList();
});

randomButton.addEventListener("click", pickRandomIncompleteWeapon);
exportButton.addEventListener("click", exportProgress);
document.addEventListener("keydown", handleKeyboardShortcut);

importInput.addEventListener("change", async () => {
  const file = importInput.files?.[0];

  if (!file) {
    return;
  }

  try {
    await importProgress(file);
    messageElement.textContent = "進捗を読み込みました。";
  } catch {
    messageElement.textContent = "進捗JSONを読み込めませんでした。";
  } finally {
    importInput.value = "";
  }
});

resetButton.addEventListener("click", () => {
  if (!window.confirm("全ブキの進捗をリセットしますか？")) {
    return;
  }

  progress = {
    version: 1,
    targetWins: progress.targetWins,
    weapons: {},
  };
  resetListControls();
  saveProgress();
  render();
});

loadWeapons().catch(() => {
  messageElement.textContent = "ブキデータを読み込めませんでした。";
});
