const api = new RestLearn.ApiSimulator();

const form = query<HTMLFormElement>("[data-request-form]");
const methodInput = query<HTMLSelectElement>("[data-method]");
const pathInput = query<HTMLInputElement>("[data-path]");
const bodyInput = query<HTMLTextAreaElement>("[data-request-body]");
const resetButton = query<HTMLButtonElement>("[data-reset]");
const hintElement = query("[data-request-hint]");
const summaryElement = query("[data-response-summary]");
const responseElement = query("[data-response]");
const stateElement = query("[data-state]");
const jwtInput = query<HTMLTextAreaElement>("[data-jwt-input]");
const decodeJwtButton = query<HTMLButtonElement>("[data-decode-jwt]");
const jwtOutput = query("[data-jwt-output]");

function query<T extends HTMLElement = HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing element: ${selector}`);
  }
  return element;
}

function decodeJwtPart(segment: string): unknown {
  if (!/^[A-Za-z0-9_-]+$/.test(segment)) {
    throw new Error("JWTにBase64url以外の文字が含まれています。");
  }

  const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}

function inspectJwt(token: string): unknown {
  const parts = token.trim().split(".");
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) {
    throw new Error("JWTはピリオドで区切られた3つの部分が必要です。");
  }

  return {
    header: decodeJwtPart(parts[0]),
    payload: decodeJwtPart(parts[1]),
    signaturePresent: parts[2].length > 0,
    signatureVerified: false,
    warning: "署名は検証していません。この内容を信用しないでください。",
  };
}

function parseBody(method: RestLearn.HttpMethod): unknown {
  if (method === "GET" || method === "DELETE") {
    return undefined;
  }

  const source = bodyInput.value.trim();
  if (!source) {
    return {};
  }
  return JSON.parse(source) as unknown;
}

function formatResponse(response: RestLearn.ApiResponse): string {
  const lines = [`HTTP/1.1 ${response.status} ${response.statusText}`];
  for (const [name, value] of Object.entries(response.headers ?? {})) {
    lines.push(`${name}: ${value}`);
  }
  if (response.body !== undefined) {
    lines.push("", JSON.stringify(response.body, null, 2));
  }
  return lines.join("\n");
}

function renderState(): void {
  stateElement.textContent = JSON.stringify(api.snapshot(), null, 2);
}

function updateMethodHint(): void {
  const method = methodInput.value as RestLearn.HttpMethod;
  const usesBody = method === "POST" || method === "PUT" || method === "PATCH";
  bodyInput.disabled = !usesBody;
  hintElement.textContent = usesBody
    ? `${method}ではJSONボディを使用します。`
    : `${method}ではこの演習のJSONボディを使用しません。`;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const method = methodInput.value as RestLearn.HttpMethod;

  try {
    const response = api.handleRequest(method, pathInput.value.trim(), parseBody(method));
    responseElement.textContent = formatResponse(response);
    summaryElement.textContent = `${response.status} ${response.statusText} — ${response.effect}`;
    summaryElement.dataset.kind = response.status >= 400 ? "error" : "success";
  } catch {
    responseElement.textContent = [
      "HTTP/1.1 400 Bad Request",
      "",
      JSON.stringify({ code: "INVALID_JSON", message: "JSONの構文が正しくありません。" }, null, 2),
    ].join("\n");
    summaryElement.textContent = "400 Bad Request — 状態は変更されませんでした。";
    summaryElement.dataset.kind = "error";
  }

  renderState();
});

methodInput.addEventListener("change", updateMethodHint);
resetButton.addEventListener("click", () => {
  api.reset();
  responseElement.textContent = "—";
  summaryElement.textContent = "状態を初期化しました。";
  summaryElement.removeAttribute("data-kind");
  renderState();
});

decodeJwtButton.addEventListener("click", () => {
  try {
    jwtOutput.textContent = JSON.stringify(inspectJwt(jwtInput.value), null, 2);
    jwtOutput.dataset.kind = "success";
  } catch (error) {
    jwtOutput.textContent = error instanceof Error ? error.message : "JWTをデコードできませんでした。";
    jwtOutput.dataset.kind = "error";
  }
});

for (const quiz of document.querySelectorAll<HTMLElement>("[data-quiz]")) {
  const feedback = quiz.querySelector<HTMLElement>("[data-quiz-feedback]");
  const options = quiz.querySelectorAll<HTMLButtonElement>("[data-quiz-option]");
  if (!feedback) {
    continue;
  }

  for (const option of options) {
    option.addEventListener("click", () => {
      const correct = option.dataset.correct === "true";
      for (const candidate of options) {
        candidate.classList.toggle("is-selected", candidate === option);
        candidate.classList.toggle("is-correct", candidate.dataset.correct === "true");
      }
      feedback.textContent = correct
        ? "正解です。"
        : "不正解です。本文の定義と例をもう一度確認してください。";
      feedback.dataset.kind = correct ? "success" : "error";
    });
  }
}

updateMethodHint();
renderState();
