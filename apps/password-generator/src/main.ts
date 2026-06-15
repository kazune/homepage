type CharacterSetName = "lower" | "upper" | "number" | "symbol";
type CharacterSet = {
  name: CharacterSetName;
  characters: string[];
};

const defaultSymbolCharacters = "!@#$%_-+=?";
const characterSets: Record<Exclude<CharacterSetName, "symbol">, string> = {
  lower: "abcdefghijklmnopqrstuvwxyz",
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  number: "0123456789",
};

const ambiguousCharacters = new Set("0O1lI");

const form = query<HTMLFormElement>("[data-form]");
const lengthInput = query<HTMLInputElement>("[data-length]");
const countInput = query<HTMLInputElement>("[data-count]");
const symbolsInput = query<HTMLInputElement>("[data-symbols]");
const excludeAmbiguousInput = query<HTMLInputElement>("[data-exclude-ambiguous]");
const generateButton = query<HTMLButtonElement>("[data-generate]");
const resultsElement = query("[data-results]");
const messageElement = query("[data-message]");

symbolsInput.value = defaultSymbolCharacters;

function query<T extends HTMLElement = HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);

  if (!element) {
    throw new Error(`Missing element: ${selector}`);
  }

  return element;
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(Math.max(Math.floor(value), min), max);
}

function randomIndex(max: number) {
  if (max <= 0) {
    throw new Error("Cannot generate a random index for an empty set.");
  }

  const limit = Math.floor(0xffffffff / max) * max;
  const value = new Uint32Array(1);

  do {
    crypto.getRandomValues(value);
  } while (value[0] >= limit);

  return value[0] % max;
}

function shuffleCharacters(characters: string[]) {
  const shuffled = [...characters];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

function selectedCharacterSets() {
  const inputs = Array.from(
    document.querySelectorAll<HTMLInputElement>("[data-charset]:checked"),
  );

  return inputs.map((input) => input.dataset.charset as CharacterSetName);
}

function uniqueCharacters(value: string) {
  return Array.from(new Set(Array.from(value).filter((character) => !/\s/u.test(character))));
}

function charactersForSet(setName: CharacterSetName, excludeAmbiguous: boolean) {
  const source = setName === "symbol" ? symbolsInput.value : characterSets[setName];
  const characters = uniqueCharacters(source);

  if (!excludeAmbiguous) {
    return characters;
  }

  return characters.filter((character) => !ambiguousCharacters.has(character));
}

function selectedCharacterSetData(setNames: CharacterSetName[], excludeAmbiguous: boolean) {
  return setNames.map((name) => ({
    name,
    characters: charactersForSet(name, excludeAmbiguous),
  }));
}

function generatePassword(length: number, sets: CharacterSet[]) {
  const requiredCharacters = sets.map((set) => set.characters[randomIndex(set.characters.length)]);
  const allCharacters = sets.flatMap((set) => set.characters);
  const passwordCharacters = [...requiredCharacters];

  while (passwordCharacters.length < length) {
    passwordCharacters.push(allCharacters[randomIndex(allCharacters.length)]);
  }

  return shuffleCharacters(passwordCharacters).join("");
}

async function copyPassword(password: string, button: HTMLButtonElement) {
  try {
    await navigator.clipboard.writeText(password);
    button.textContent = "コピー済み";
    messageElement.textContent = "クリップボードにコピーしました。";
    window.setTimeout(() => {
      button.textContent = "コピー";
    }, 1200);
  } catch {
    messageElement.textContent = "コピーできませんでした。手動で選択してください。";
  }
}

function renderPasswords(passwords: string[]) {
  resultsElement.replaceChildren();

  for (const password of passwords) {
    const row = document.createElement("div");
    row.className = "result-row";

    const output = document.createElement("output");
    output.value = password;
    output.textContent = password;

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.textContent = "コピー";
    copyButton.addEventListener("click", () => {
      void copyPassword(password, copyButton);
    });

    row.append(output, copyButton);
    resultsElement.append(row);
  }
}

function generate() {
  const setNames = selectedCharacterSets();
  const sets = selectedCharacterSetData(setNames, excludeAmbiguousInput.checked);
  const emptySet = sets.find((set) => set.characters.length === 0);

  if (setNames.length === 0) {
    resultsElement.replaceChildren();
    messageElement.textContent = "文字種を1つ以上選択してください。";
    return;
  }

  if (emptySet) {
    resultsElement.replaceChildren();
    messageElement.textContent =
      emptySet.name === "symbol"
        ? "記号を使う場合は、使用できる記号を1文字以上入力してください。"
        : "選択した文字種に使用できる文字がありません。";
    return;
  }

  const length = clamp(lengthInput.valueAsNumber, 4, 128);
  const count = clamp(countInput.valueAsNumber, 1, 20);
  const minimumLength = Math.max(4, sets.length);
  const safeLength = Math.max(length, minimumLength);

  lengthInput.value = String(safeLength);
  countInput.value = String(count);

  const passwords = Array.from({ length: count }, () =>
    generatePassword(safeLength, sets),
  );

  renderPasswords(passwords);
  messageElement.textContent = "生成されたパスワードは保存されません。";
}

form.addEventListener("change", generate);
form.addEventListener("input", generate);
form.addEventListener("submit", (event) => {
  event.preventDefault();
  generate();
});
generateButton.addEventListener("click", generate);

generate();
