type Elements = {
  form: HTMLFormElement;
  branch: HTMLInputElement;
  commitMessage: HTMLInputElement;
  changedTargets: HTMLTextAreaElement;
  outputBefore: HTMLTextAreaElement;
  outputPrompt: HTMLTextAreaElement;
  outputGithub: HTMLTextAreaElement;
  outputAfter: HTMLTextAreaElement;
  copyBeforeButton: HTMLButtonElement;
  copyPromptButton: HTMLButtonElement;
  copyGithubButton: HTMLButtonElement;
  copyAfterButton: HTMLButtonElement;
  status: HTMLElement;
};

function queryElements(): Elements {
  const form = document.querySelector("[data-form]") as HTMLFormElement | null;
  const branch = document.querySelector("input[name='branch']") as HTMLInputElement | null;
  const commitMessage = document.querySelector(
    "input[name='commitMessage']",
  ) as HTMLInputElement | null;
  const changedTargets = document.querySelector(
    "textarea[name='changedTargets']",
  ) as HTMLTextAreaElement | null;
  const outputBefore = document.querySelector("[data-output-before]") as HTMLTextAreaElement | null;
  const outputPrompt = document.querySelector("[data-output-prompt]") as HTMLTextAreaElement | null;
  const outputGithub = document.querySelector("[data-output-github]") as HTMLTextAreaElement | null;
  const outputAfter = document.querySelector("[data-output-after]") as HTMLTextAreaElement | null;
  const copyBeforeButton = document.querySelector("[data-copy-before]") as HTMLButtonElement | null;
  const copyPromptButton = document.querySelector("[data-copy-prompt]") as HTMLButtonElement | null;
  const copyGithubButton = document.querySelector("[data-copy-github]") as HTMLButtonElement | null;
  const copyAfterButton = document.querySelector("[data-copy-after]") as HTMLButtonElement | null;
  const status = document.querySelector("[data-status]") as HTMLElement | null;

  if (
    !form ||
    !branch ||
    !commitMessage ||
    !changedTargets ||
    !outputBefore ||
    !outputPrompt ||
    !outputGithub ||
    !outputAfter ||
    !copyBeforeButton ||
    !copyPromptButton ||
    !copyGithubButton ||
    !copyAfterButton ||
    !status
  ) {
    throw new Error("Required elements are missing.");
  }

  return {
    form,
    branch,
    commitMessage,
    changedTargets,
    outputBefore,
    outputPrompt,
    outputGithub,
    outputAfter,
    copyBeforeButton,
    copyPromptButton,
    copyGithubButton,
    copyAfterButton,
    status,
  };
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function stripWrappingQuotes(value: string): string {
  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }
  return value;
}

function normalizeTargets(value: string): string[] {
  const flattened = value
    .replace(/\r/g, "\n")
    .replace(/\\\s*\n/g, " ")
    .replace(/\n/g, " ")
    .trim();

  if (!flattened) return [];

  const rawTokens = flattened.split(/\s+/).filter((v) => v.length > 0);
  const targetTokens =
    rawTokens.length >= 2 && rawTokens[0] === "git" && rawTokens[1] === "add"
      ? rawTokens.slice(2)
      : rawTokens;

  return targetTokens.filter((v) => v !== "\\").map(stripWrappingQuotes);
}

function buildAddCommand(changedTargets: string): string {
  const targets = normalizeTargets(changedTargets).map(shellQuote);
  return `git add ${targets.join(" ")}`;
}

function buildBeforeGithubCommands(branch: string, message: string, changedTargets: string): string {
  const branchQuoted = shellQuote(branch);
  const messageQuoted = shellQuote(message);

  return [
    "# github操作前: branch作成〜push",
    `git switch -c ${branchQuoted}`,
    "git status",
    buildAddCommand(changedTargets),
    `git commit -m ${messageQuoted}`,
    `git push -u origin ${branchQuoted}`,
  ].join("\n");
}

function buildGithubSteps(branch: string): string {
  return [
    "# github操作:",
    "# 1) GitHubで main 向け Pull Request を作成",
    `#    Base: main / Compare: ${branch}`,
    "# 2) レビュー後に Pull Request を Merge",
    "# 3) GitHub上のブランチを Delete",
  ].join("\n");
}

function buildCodexPrompt(changedTargets: string): string {
  const targets = normalizeTargets(changedTargets);
  const targetsLine =
    targets.length > 0
      ? `- 変更対象ファイル: ${targets.join(", ")}`
      : "- 変更対象ファイル: <ここに対象ファイルを列挙>";

  return [
    "以下の要件で、Git運用に使う案を作ってください。",
    "",
    "- 変更内容: <ここに今回の変更内容を1-2行で記入>",
    targetsLine,
    "- ブランチ接頭辞は feature/ chore/ fix/ のいずれか",
    "- git add . は使わず、変更対象ファイルを明示する",
    "",
    "出力してほしいもの:",
    "1. ブランチ名を1つ",
    "2. コミットメッセージを1つ",
    "3. git add で指定する変更対象ファイルの一覧",
    "4. それぞれの採用理由を1文ずつ",
    "",
    "出力形式:",
    "- 次の見出し順で出力する: ブランチ名 / コミットメッセージ / 変更対象ファイル一覧",
    "- 見出しの直下に ``` のコードブロックを置く",
    "- 例: ブランチ名 の次の行に ```feature/xxx``` を置く形式",
    "",
    "出力例:",
    "ブランチ名",
    "```text",
    "feature/add-git-pr-helper-app",
    "```",
    "",
    "コミットメッセージ",
    "```text",
    "Add git-pr-helper app for branch/commit/add command generation",
    "```",
    "",
    "変更対象ファイル一覧",
    "```bash",
    "git add \\",
    "  apps/git-pr-helper/src/index.html \\",
    "  apps/git-pr-helper/src/main.ts \\",
    "  apps/git-pr-helper/src/style.css \\",
    "  apps/git-pr-helper/README.md",
    "```",
  ].join("\n");
}

function buildAfterGithubCommands(branch: string): string {
  const branchQuoted = shellQuote(branch);

  return [
    "# github操作後: PR merge後の後片付け",
    "git switch main",
    "git pull",
    `git branch -d ${branchQuoted}`,
    "git fetch -p",
  ].join("\n");
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function main() {
  const elements = queryElements();

  const renderPrompt = () => {
    const changedTargets = elements.changedTargets.value.trim();
    elements.outputPrompt.value = buildCodexPrompt(changedTargets);
  };

  const render = () => {
    const branch = elements.branch.value.trim();
    const message = elements.commitMessage.value.trim();
    const changedTargets = elements.changedTargets.value.trim();

    if (!branch || !message || normalizeTargets(changedTargets).length === 0) {
      elements.outputBefore.value = "";
      elements.outputGithub.value = "";
      elements.outputAfter.value = "";
      renderPrompt();
      return;
    }

    elements.outputBefore.value = buildBeforeGithubCommands(branch, message, changedTargets);
    elements.outputGithub.value = buildGithubSteps(branch);
    elements.outputAfter.value = buildAfterGithubCommands(branch);
    renderPrompt();
  };

  elements.form.addEventListener("submit", (event) => {
    event.preventDefault();

    if (
      !elements.branch.value.trim() ||
      !elements.commitMessage.value.trim() ||
      normalizeTargets(elements.changedTargets.value.trim()).length === 0
    ) {
      elements.status.textContent = "Branch Name / Commit Message / Changed Targets を入力してください。";
      return;
    }

    render();
    elements.status.textContent = "生成しました。";
  });

  elements.copyBeforeButton.addEventListener("click", async () => {
    if (!elements.outputBefore.value.trim()) {
      elements.status.textContent = "先に Generate してください。";
      return;
    }

    const ok = await copyToClipboard(elements.outputBefore.value);
    elements.status.textContent = ok ? "github操作前をコピーしました。" : "コピーに失敗しました。";
  });

  elements.copyGithubButton.addEventListener("click", async () => {
    if (!elements.outputGithub.value.trim()) {
      elements.status.textContent = "先に Generate してください。";
      return;
    }

    const ok = await copyToClipboard(elements.outputGithub.value);
    elements.status.textContent = ok ? "github操作をコピーしました。" : "コピーに失敗しました。";
  });

  elements.copyPromptButton.addEventListener("click", async () => {
    if (!elements.outputPrompt.value.trim()) renderPrompt();

    const ok = await copyToClipboard(elements.outputPrompt.value);
    elements.status.textContent = ok ? "Codex依頼プロンプトをコピーしました。" : "コピーに失敗しました。";
  });

  elements.copyAfterButton.addEventListener("click", async () => {
    if (!elements.outputAfter.value.trim()) {
      elements.status.textContent = "先に Generate してください。";
      return;
    }

    const ok = await copyToClipboard(elements.outputAfter.value);
    elements.status.textContent = ok ? "github操作後をコピーしました。" : "コピーに失敗しました。";
  });

  elements.branch.value = "";
  elements.commitMessage.value = "";
  elements.changedTargets.value = "";
  render();
}

main();
