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

type WeaponProgress = {
  wins: number;
  matches: number;
  updatedAt?: string;
};

type Progress = {
  version: 1;
  targetWins: number;
  weapons: Record<string, WeaponProgress>;
};

type StatusFilter = "all" | "complete" | "incomplete" | "unused";

const storageKey = "splatoon3-weapon-challenge:v1";
const defaultProgress: Progress = {
  version: 1,
  targetWins: 1,
  weapons: {},
};

let weapons: Weapon[] = [];
let progress: Progress = loadProgress();
let gameVersion = "";
let searchText = "";
let classFilter = "all";
let statusFilter: StatusFilter = "incomplete";
let selectedWeaponId: string | null = null;

const targetWinsInput = query<HTMLInputElement>("[data-target-wins]");
const completeCountElement = query("[data-complete-count]");
const completeRateElement = query("[data-complete-rate]");
const totalWinsElement = query("[data-total-wins]");
const totalMatchesElement = query("[data-total-matches]");
const searchInput = query<HTMLInputElement>("[data-search]");
const classFilterSelect = query<HTMLSelectElement>("[data-class-filter]");
const statusFilterSelect = query<HTMLSelectElement>("[data-status-filter]");
const randomButton = query<HTMLButtonElement>("[data-random]");
const selectedEmptyElement = query<HTMLElement>("[data-selected-empty]");
const selectedDetailElement = query<HTMLElement>("[data-selected-detail]");
const selectedStatusElement = query("[data-selected-status]");
const selectedNameElement = query("[data-selected-name]");
const selectedWinsElement = query("[data-selected-wins]");
const selectedLossesElement = query("[data-selected-losses]");
const selectedRateElement = query("[data-selected-rate]");
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
    const matches = Math.max(wins, normalizeNonNegativeInteger(item.matches, 0));

    if (wins === 0 && matches === 0) {
      continue;
    }

    result[weaponId] = {
      wins,
      matches,
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
  return progress.weapons[weaponId] ?? { wins: 0, matches: 0 };
}

function setWeaponProgress(weaponId: string, nextProgress: WeaponProgress) {
  const wins = Math.max(0, Math.floor(nextProgress.wins));
  const matches = Math.max(wins, Math.floor(nextProgress.matches));

  if (wins === 0 && matches === 0) {
    delete progress.weapons[weaponId];
  } else {
    progress.weapons[weaponId] = {
      wins,
      matches,
      updatedAt: new Date().toISOString(),
    };
  }

  saveProgress();
  render();
}

function isComplete(weaponId: string) {
  return getWeaponProgress(weaponId).wins >= progress.targetWins;
}

function matchesStatus(weapon: Weapon) {
  const item = getWeaponProgress(weapon.id);

  if (statusFilter === "all") {
    return true;
  }

  if (statusFilter === "complete") {
    return item.wins >= progress.targetWins;
  }

  if (statusFilter === "unused") {
    return item.wins === 0 && item.matches === 0;
  }

  return item.wins < progress.targetWins;
}

function matchesSearch(weapon: Weapon) {
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
  return weapons.filter((weapon) => {
    const classMatches = classFilter === "all" || weapon.class.id === classFilter;

    return classMatches && matchesStatus(weapon) && matchesSearch(weapon);
  });
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
  let totalMatches = 0;

  for (const weapon of weapons) {
    const item = getWeaponProgress(weapon.id);
    totalWins += item.wins;
    totalMatches += item.matches;
  }

  return {
    completeCount,
    totalWins,
    totalMatches,
  };
}

function renderSummary() {
  const totals = calculateTotals();
  const completeRate = weapons.length === 0 ? 0 : (totals.completeCount / weapons.length) * 100;

  completeCountElement.textContent = `${totals.completeCount} / ${weapons.length}`;
  completeRateElement.textContent = `${completeRate.toFixed(1)}%`;
  totalWinsElement.textContent = String(totals.totalWins);
  totalMatchesElement.textContent = String(totals.totalMatches);
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
  const losses = Math.max(0, item.matches - item.wins);
  const winRate = item.matches > 0 ? `${((item.wins / item.matches) * 100).toFixed(1)}%` : "--";

  selectedEmptyElement.hidden = true;
  selectedDetailElement.hidden = false;
  selectedStatusElement.className = `status ${complete ? "complete" : "incomplete"}`;
  selectedStatusElement.textContent = complete ? "達成済み" : "未達成";
  selectedNameElement.textContent = weapon.name.ja;
  selectedWinsElement.textContent = String(item.wins);
  selectedLossesElement.textContent = String(losses);
  selectedRateElement.textContent = winRate;
  selectedActionsElement.textContent = "";
  selectedActionsElement.append(
    createActionButton("+勝ち", "win", () => {
      setWeaponProgress(weapon.id, { wins: item.wins + 1, matches: item.matches + 1 });
    }),
    createActionButton("+負け", "loss", () => {
      setWeaponProgress(weapon.id, { wins: item.wins, matches: item.matches + 1 });
    }),
    createActionButton("-勝ち", "small", () => {
      setWeaponProgress(weapon.id, { wins: item.wins - 1, matches: item.matches - 1 });
    }, item.wins <= 0),
    createActionButton("-負け", "small", () => {
      setWeaponProgress(weapon.id, { wins: item.wins, matches: item.matches - 1 });
    }, losses <= 0),
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
  record.textContent = `${item.wins}勝 / ${item.matches}試合`;

  const status = document.createElement("span");
  status.className = `weapon-row-status ${complete ? "complete" : "incomplete"}`;
  status.textContent = complete ? "達成" : "未達";

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
  const response = await fetch("./data/weapons.json");

  if (!response.ok) {
    throw new Error(`Failed to load weapons: ${response.status}`);
  }

  const data = (await response.json()) as WeaponsData;
  weapons = data.weapons.slice().sort((a, b) => a.number - b.number);
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

async function exportProgress() {
  const payload = JSON.stringify(progress, null, 2);

  try {
    await navigator.clipboard.writeText(payload);
    messageElement.textContent = "進捗JSONをクリップボードにコピーしました。";
  } catch {
    messageElement.textContent = payload;
  }
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

randomButton.addEventListener("click", pickRandomIncompleteWeapon);
exportButton.addEventListener("click", exportProgress);

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
  saveProgress();
  render();
});

loadWeapons().catch(() => {
  messageElement.textContent = "ブキデータを読み込めませんでした。";
});
