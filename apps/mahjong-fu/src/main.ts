type Shape = "standard" | "seven-pairs";
type WinMethod = "ron" | "tsumo";
type PairType = "ordinary" | "dragon" | "round" | "seat" | "double-wind";
type MeldKind = "sequence" | "triplet" | "quad";
type Exposure = "closed" | "open";
type TileCategory = "simple" | "terminal-honor";
type WaitType = "ryanmen" | "shanpon" | "kanchan" | "penchan" | "tanki";

type Meld = {
  index: number;
  kind: MeldKind;
  exposure: Exposure;
  category: TileCategory;
};

type FuItem = {
  label: string;
  fu: number;
};

const form = query<HTMLFormElement>("[data-form]");
const standardFields = query("[data-standard-fields]");
const winningMeldSection = query("[data-winning-meld-section]");
const winningMeldOptions = query("[data-winning-meld-options]");
const resultElement = query<HTMLOutputElement>("[data-result]");
const roundingElement = query("[data-rounding]");
const breakdownElement = query<HTMLDListElement>("[data-breakdown]");
const scoreCaptionElement = query<HTMLTableCaptionElement>("[data-score-caption]");
const scoreBodyElement = query<HTMLTableSectionElement>("[data-score-body]");
const scoreNoteElement = query("[data-score-note]");
const noticeElement = query("[data-notice]");
const meldElements = Array.from(document.querySelectorAll<HTMLElement>("[data-meld]"));

function query<T extends HTMLElement = HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);

  if (!element) {
    throw new Error(`Missing element: ${selector}`);
  }

  return element;
}

function selectedValue<T extends string>(name: string): T {
  const input = form.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`);

  if (!input) {
    throw new Error(`Missing selection: ${name}`);
  }

  return input.value as T;
}

function readMelds(): Meld[] {
  return [1, 2, 3, 4].map((index) => ({
    index,
    kind: selectedValue<MeldKind>(`meld-${index}-kind`),
    exposure: selectedValue<Exposure>(`meld-${index}-exposure`),
    category: selectedValue<TileCategory>(`meld-${index}-category`),
  }));
}

function pairFu(pair: PairType) {
  const values: Record<PairType, number> = {
    ordinary: 0,
    dragon: 2,
    round: 2,
    seat: 2,
    "double-wind": 4,
  };

  return values[pair];
}

function pairLabel(pair: PairType) {
  const labels: Record<PairType, string> = {
    ordinary: "数牌・客風牌の雀頭",
    dragon: "三元牌の雀頭",
    round: "場風牌の雀頭",
    seat: "自風牌の雀頭",
    "double-wind": "連風牌の雀頭",
  };

  return labels[pair];
}

function meldFu(meld: Meld, isRonCompletedTriplet: boolean) {
  if (meld.kind === "sequence") {
    return 0;
  }

  const isOpen = meld.exposure === "open" || isRonCompletedTriplet;
  const isTerminalOrHonor = meld.category === "terminal-honor";
  let fu = meld.kind === "triplet" ? 2 : 8;

  if (!isOpen) {
    fu *= 2;
  }

  if (isTerminalOrHonor) {
    fu *= 2;
  }

  return fu;
}

function meldLabel(meld: Meld, isRonCompletedTriplet: boolean) {
  const effectiveExposure = meld.exposure === "open" || isRonCompletedTriplet ? "明" : "暗";
  const category = meld.category === "terminal-honor" ? "么九牌" : "中張牌";
  const kind = meld.kind === "triplet" ? "刻" : "槓";

  return `メンツ${meld.index}：${category}の${effectiveExposure}${kind}`;
}

function waitFu(wait: WaitType) {
  return wait === "kanchan" || wait === "penchan" || wait === "tanki" ? 2 : 0;
}

function waitLabel(wait: WaitType) {
  const labels: Record<WaitType, string> = {
    ryanmen: "両面待ち",
    shanpon: "シャンポン待ち",
    kanchan: "嵌張待ち",
    penchan: "辺張待ち",
    tanki: "単騎待ち",
  };

  return labels[wait];
}

function renderBreakdown(items: FuItem[]) {
  breakdownElement.replaceChildren();

  for (const item of items) {
    const term = document.createElement("dt");
    const detail = document.createElement("dd");
    term.textContent = item.label;
    detail.textContent = `${item.fu}符`;
    breakdownElement.append(term, detail);
  }
}

function roundUpToHundred(points: number) {
  return Math.ceil(points / 100) * 100;
}

function formatPoints(points: number) {
  return points.toLocaleString("ja-JP");
}

function scoreText(basePoints: number, win: WinMethod, isDealer: boolean) {
  if (win === "ron") {
    const points = roundUpToHundred(basePoints * (isDealer ? 6 : 4));
    return `${formatPoints(points)}点`;
  }

  const dealerPayment = roundUpToHundred(basePoints * 2);

  if (isDealer) {
    return `${formatPoints(dealerPayment)}点オール`;
  }

  const childPayment = roundUpToHundred(basePoints);
  return `${formatPoints(childPayment)} / ${formatPoints(dealerPayment)}点`;
}

function renderScoreTable(fu: number, win: WinMethod) {
  scoreCaptionElement.textContent = `1〜4翻の点数（${win === "ron" ? "ロン" : "ツモ"}）`;
  scoreBodyElement.replaceChildren();

  for (let han = 1; han <= 4; han += 1) {
    const row = document.createElement("tr");
    const hanCell = document.createElement("th");
    const childCell = document.createElement("td");
    const dealerCell = document.createElement("td");
    const isUnavailable = han === 1 && (fu === 20 || fu === 25);
    const uncappedBasePoints = fu * 2 ** (han + 2);
    const isMangan = uncappedBasePoints >= 2000;
    const basePoints = Math.min(uncappedBasePoints, 2000);

    hanCell.scope = "row";
    hanCell.textContent = `${han}翻`;

    if (isMangan) {
      const limitLabel = document.createElement("span");
      limitLabel.className = "limit-label";
      limitLabel.textContent = "満貫";
      hanCell.append(limitLabel);
    }

    childCell.textContent = isUnavailable ? "—" : scoreText(basePoints, win, false);
    dealerCell.textContent = isUnavailable ? "—" : scoreText(basePoints, win, true);
    row.append(hanCell, childCell, dealerCell);
    scoreBodyElement.append(row);
  }

  const paymentNote =
    win === "tsumo"
      ? "子の和了は「子の支払い / 親の支払い」、親の和了はオール表記です。"
      : "ロンした人が受け取る点数です。";
  const unavailableNote =
    fu === 20 || fu === 25 ? " 20符・25符の1翻は成立しないため「—」で表示します。" : "";
  scoreNoteElement.textContent = `${paymentNote}${unavailableNote} 積み棒・供託は含まず、切り上げ満貫は採用していません。`;
}

function setNotice(message: string | null) {
  noticeElement.hidden = message === null;
  noticeElement.textContent = message ?? "";
}

function renderSevenPairs() {
  const win = selectedValue<WinMethod>("win");
  resultElement.value = "25符";
  resultElement.textContent = "25符";
  roundingElement.textContent = "七対子は固定25符";
  renderBreakdown([{ label: "七対子", fu: 25 }]);
  renderScoreTable(25, win);
  setNotice(null);
}

function selectedWinningMeld() {
  const input = form.querySelector<HTMLInputElement>('input[name="winning-meld"]:checked');
  return input ? Number(input.value) : null;
}

function renderStandardHand() {
  const win = selectedValue<WinMethod>("win");
  const pair = selectedValue<PairType>("pair");
  const wait = selectedValue<WaitType>("wait");
  const melds = readMelds();
  const isClosedHand = melds.every((meld) => meld.exposure === "closed");
  const winningMeld = win === "ron" && wait === "shanpon" ? selectedWinningMeld() : null;
  const isPinfuTsumo =
    win === "tsumo" &&
    isClosedHand &&
    pair === "ordinary" &&
    wait === "ryanmen" &&
    melds.every((meld) => meld.kind === "sequence");

  if (isPinfuTsumo) {
    resultElement.value = "20符";
    resultElement.textContent = "20符";
    roundingElement.textContent = "平和ツモ形は20符";
    renderBreakdown([{ label: "平和ツモ形", fu: 20 }]);
    renderScoreTable(20, win);
    setNotice(null);
    return;
  }

  const items: FuItem[] = [{ label: "基本符", fu: 20 }];

  if (win === "ron" && isClosedHand) {
    items.push({ label: "門前ロン", fu: 10 });
  }

  if (win === "tsumo") {
    items.push({ label: "ツモ", fu: 2 });
  }

  const headFu = pairFu(pair);
  if (headFu > 0) {
    items.push({ label: pairLabel(pair), fu: headFu });
  }

  for (const meld of melds) {
    const isRonCompletedTriplet = meld.kind === "triplet" && meld.index === winningMeld;
    const fu = meldFu(meld, isRonCompletedTriplet);

    if (fu > 0) {
      items.push({ label: meldLabel(meld, isRonCompletedTriplet), fu });
    }
  }

  const waitingFu = waitFu(wait);
  if (waitingFu > 0) {
    items.push({ label: waitLabel(wait), fu: waitingFu });
  }

  const rawFu = items.reduce((sum, item) => sum + item.fu, 0);
  const roundedFu = rawFu === 20 ? 30 : Math.ceil(rawFu / 10) * 10;
  resultElement.value = `${roundedFu}符`;
  resultElement.textContent = `${roundedFu}符`;
  roundingElement.textContent = rawFu === roundedFu ? `合計 ${rawFu}符` : `合計 ${rawFu}符 → ${roundedFu}符`;
  renderBreakdown(items);
  renderScoreTable(roundedFu, win);

  const hasClosedTriplet = melds.some(
    (meld) => meld.kind === "triplet" && meld.exposure === "closed",
  );
  const hasSequence = melds.some((meld) => meld.kind === "sequence");

  if (wait === "shanpon" && !hasClosedTriplet) {
    setNotice("シャンポン待ちの完成形には暗の刻子が必要です。メンツの種類を確認してください。");
  } else if ((wait === "ryanmen" || wait === "kanchan" || wait === "penchan") && !hasSequence) {
    setNotice("この待ちの完成形には順子が必要です。メンツの種類を確認してください。");
  } else {
    setNotice(null);
  }
}

function syncMeldControls() {
  for (const meldElement of meldElements) {
    const index = meldElement.dataset.meld;
    const kind = selectedValue<MeldKind>(`meld-${index}-kind`);
    const categoryRow = meldElement.querySelector<HTMLElement>("[data-category-row]");

    if (categoryRow) {
      categoryRow.hidden = kind === "sequence";
    }
  }
}

function syncWinningMeldOptions() {
  const win = selectedValue<WinMethod>("win");
  const wait = selectedValue<WaitType>("wait");
  const melds = readMelds();
  const triplets = melds.filter(
    (meld) => meld.kind === "triplet" && meld.exposure === "closed",
  );
  const previousSelection = selectedWinningMeld();
  const nextSelection = triplets.some((meld) => meld.index === previousSelection)
    ? previousSelection
    : (triplets[0]?.index ?? null);
  const shouldShow = win === "ron" && wait === "shanpon";

  winningMeldSection.hidden = !shouldShow;
  winningMeldOptions.replaceChildren();

  if (!shouldShow) {
    return;
  }

  for (const meld of triplets) {
    const label = document.createElement("label");
    const input = document.createElement("input");
    const text = document.createElement("span");
    label.className = "choice";
    input.type = "radio";
    input.name = "winning-meld";
    input.value = String(meld.index);
    input.checked = nextSelection === meld.index;
    text.textContent = `メンツ ${meld.index}`;
    label.append(input, text);
    winningMeldOptions.append(label);
  }

  if (triplets.length === 0) {
    const message = document.createElement("p");
    message.className = "hint";
    message.textContent = "刻子を選ぶと、ここで和了したメンツを指定できます。";
    winningMeldOptions.append(message);
  }
}

function update() {
  const shape = selectedValue<Shape>("shape");
  standardFields.hidden = shape === "seven-pairs";

  if (shape === "seven-pairs") {
    renderSevenPairs();
    return;
  }

  syncMeldControls();
  syncWinningMeldOptions();
  renderStandardHand();
}

form.addEventListener("change", update);
update();
