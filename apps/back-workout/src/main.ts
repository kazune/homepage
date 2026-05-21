type Pain = "none" | "mild" | "bad";

type WorkoutLog = {
  date: string;
  completed: string[];
  pain: Pain;
};

const STORAGE_KEY = "back_workout_logs_v1";
const MENU = ["ダンベルロウ", "バックエクステンション", "タオルラットプル"];

const painLabels: Record<Pain, string> = {
  none: "問題なし",
  mild: "少し違和感",
  bad: "痛い",
};

const form = query<HTMLFormElement>("[data-form]");
const todayElement = query("[data-today]");
const stateElement = query("[data-state]");
const menuListElement = query("[data-menu-list]");
const messageElement = query("[data-message]");
const historyElement = query<HTMLOListElement>("[data-history]");

function query<T extends HTMLElement = HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);

  if (!element) {
    throw new Error(`Missing element: ${selector}`);
  }

  return element;
}

function todayKey() {
  return toDateKey(new Date());
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function dateOffset(base: Date, offsetDays: number) {
  const date = new Date(base);
  date.setDate(date.getDate() + offsetDays);
  return date;
}

function formatDisplayDate(dateKey: string) {
  const [, month, day] = dateKey.split("-");
  return `${Number(month)}/${Number(day)}`;
}

function isPain(value: FormDataEntryValue | null): value is Pain {
  return value === "none" || value === "mild" || value === "bad";
}

function loadLogs(): WorkoutLog[] {
  const raw = localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isWorkoutLog);
  } catch {
    return [];
  }
}

function isWorkoutLog(value: unknown): value is WorkoutLog {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const log = value as Record<string, unknown>;

  return (
    typeof log.date === "string" &&
    Array.isArray(log.completed) &&
    log.completed.every((item) => typeof item === "string") &&
    (log.pain === "none" || log.pain === "mild" || log.pain === "bad")
  );
}

function saveLogs(logs: WorkoutLog[]) {
  const orderedLogs = [...logs].sort((a, b) => b.date.localeCompare(a.date));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orderedLogs));
}

function upsertLog(nextLog: WorkoutLog) {
  const logs = loadLogs();
  const otherLogs = logs.filter((log) => log.date !== nextLog.date);
  saveLogs([nextLog, ...otherLogs]);
}

function findLog(dateKey: string) {
  return loadLogs().find((log) => log.date === dateKey) ?? null;
}

function renderMenu() {
  menuListElement.replaceChildren(
    ...MENU.map((label, index) => {
      const id = `menu-${index}`;
      const wrapper = document.createElement("label");
      const input = document.createElement("input");
      const text = document.createElement("span");

      input.type = "checkbox";
      input.name = "completed";
      input.value = label;
      input.id = id;
      text.textContent = label;
      wrapper.htmlFor = id;
      wrapper.append(input, text);

      return wrapper;
    })
  );
}

function applyTodayLog() {
  const log = findLog(todayKey());
  const completedInputs = form.querySelectorAll<HTMLInputElement>(
    'input[name="completed"]'
  );
  const painInputs = form.querySelectorAll<HTMLInputElement>('input[name="pain"]');

  completedInputs.forEach((input) => {
    input.checked = log?.completed.includes(input.value) ?? false;
  });

  painInputs.forEach((input) => {
    input.checked = log ? input.value === log.pain : input.value === "none";
  });

  stateElement.textContent = log ? "記録済み" : "未記録";
}

function renderHistory() {
  const logs = loadLogs();
  const baseDate = new Date();
  const items = Array.from({ length: 7 }, (_, index) => {
    const dateKey = toDateKey(dateOffset(baseDate, -index));
    const log = logs.find((item) => item.date === dateKey);
    const item = document.createElement("li");
    const date = document.createElement("span");
    const summary = document.createElement("span");
    const pain = document.createElement("span");

    date.className = "history-date";
    summary.className = "history-summary";
    pain.className = "history-pain";
    date.textContent = formatDisplayDate(dateKey);

    if (log) {
      summary.textContent = `${log.completed.length}/${MENU.length}`;
      pain.textContent = painLabels[log.pain];
      pain.dataset.pain = log.pain;
    } else {
      summary.textContent = "未記録";
      pain.textContent = "--";
    }

    item.append(date, summary, pain);
    return item;
  });

  historyElement.replaceChildren(...items);
}

function setMessage(text: string) {
  messageElement.textContent = text;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  const pain = formData.get("pain");

  if (!isPain(pain)) {
    setMessage("腰の状態を選んでください。");
    return;
  }

  const completed = formData
    .getAll("completed")
    .filter((value): value is string => typeof value === "string");

  upsertLog({
    date: todayKey(),
    completed,
    pain,
  });

  applyTodayLog();
  renderHistory();
  setMessage("今日の記録を保存しました。");
});

todayElement.textContent = new Date().toLocaleDateString("ja-JP", {
  month: "long",
  day: "numeric",
  weekday: "short",
});

renderMenu();
applyTodayLog();
renderHistory();
