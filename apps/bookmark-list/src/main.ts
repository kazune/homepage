import { decodeList, encodeList, validateList, type Bookmark, type BookmarkList, type SaveFormat } from "./data.js";

function element<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element: ${id}`);
  return node as T;
}

const viewer = element("viewer");
const editor = element("editor");
const rows = element("rows");
const listTitle = element<HTMLInputElement>("list-title");
const formError = element("form-error");
const message = element("message");
let current: BookmarkList | null = null;
let loadRevision = 0;
let saving = false;

function addRow(link: Bookmark = { name: "", url: "" }, focus = false): void {
  const template = element<HTMLTemplateElement>("row-template");
  const fragment = template.content.cloneNode(true) as DocumentFragment;
  const row = fragment.querySelector<HTMLFieldSetElement>("fieldset")!;
  const name = row.querySelector<HTMLInputElement>('[name="link-name"]')!;
  const url = row.querySelector<HTMLInputElement>('[name="link-url"]')!;
  name.value = link.name;
  url.value = link.url;
  row.querySelector<HTMLButtonElement>(".remove")!.addEventListener("click", () => {
    row.remove();
    numberRows();
    element("add").focus();
  });
  rows.append(fragment);
  numberRows();
  if (focus) name.focus();
}

function numberRows(): void {
  rows.querySelectorAll("fieldset").forEach((row, index) => {
    row.querySelector("legend")!.textContent = `リンク ${index + 1}`;
    row.querySelector("button")!.setAttribute("aria-label", `リンク${index + 1}を削除`);
  });
}

function showEditor(): void {
  rows.replaceChildren();
  listTitle.value = current?.title ?? "";
  (current?.links ?? [{ name: "", url: "" }]).forEach(link => addRow(link));
  element("editor-title").textContent = current ? "ブックマークを編集" : "ブックマークを作る";
  element("cancel").hidden = !current;
  formError.textContent = "";
  document.querySelector<HTMLInputElement>('input[name="save-format"][value="auto"]')!.checked = true;
  message.textContent = "";
  viewer.hidden = true;
  editor.hidden = false;
}

function showViewer(): void {
  if (!current) return;
  element("page-title").textContent = current.title;
  document.title = `${current.title} | 共有ブックマーク`;
  element("link-count").textContent = `${current.links.length}件のリンク`;
  const list = element("bookmark-list");
  list.replaceChildren();
  current.links.forEach(link => {
    const item = document.createElement("li");
    const anchor = document.createElement("a");
    anchor.className = "bookmark";
    anchor.href = link.url;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    const text = document.createElement("span");
    text.className = "bookmark-text";
    const name = document.createElement("span");
    name.className = "bookmark-name";
    name.textContent = link.name;
    const icon = document.createElement("span");
    icon.className = "open-icon";
    icon.textContent = "↗";
    icon.setAttribute("aria-hidden", "true");
    text.append(name);
    anchor.append(text, icon);
    item.append(anchor);
    list.append(item);
  });
  element("copy-fallback").hidden = true;
  viewer.hidden = false;
  editor.hidden = true;
}

async function load(): Promise<void> {
  const revision = ++loadRevision;
  const hash = location.hash;
  current = null;
  const loadError = element("load-error");
  loadError.hidden = true;
  message.textContent = "";
  element("page-title").textContent = "共有ブックマーク";
  document.title = "共有ブックマーク";
  viewer.hidden = true;
  editor.hidden = true;
  if (hash) {
    try {
      message.textContent = "共有リンクを読み込んでいます…";
      const decoded = await decodeList(hash);
      if (revision !== loadRevision) return;
      current = decoded;
    } catch (error) {
      if (revision !== loadRevision) return;
      loadError.textContent = typeof DecompressionStream === "undefined" && hash.startsWith("#v2=") && error instanceof Error
        ? error.message
        : "共有リンクを読み込めませんでした。URLが途中で切れていないか確認してください。新しい一覧を作ることもできます。";
      loadError.hidden = false;
    }
  }
  message.textContent = "";
  if (current) showViewer();
  else showEditor();
}

element("add").addEventListener("click", () => addRow(undefined, true));
element("edit").addEventListener("click", () => {
  showEditor();
  listTitle.focus();
});
element("cancel").addEventListener("click", showViewer);

element<HTMLFormElement>("bookmark-form").addEventListener("submit", async event => {
  event.preventDefault();
  if (saving) return;
  const revision = loadRevision;
  const format = document.querySelector<HTMLInputElement>('input[name="save-format"]:checked')!.value as SaveFormat;
  const links = Array.from(rows.querySelectorAll("fieldset"), row => ({
    name: row.querySelector<HTMLInputElement>('[name="link-name"]')!.value,
    url: row.querySelector<HTMLInputElement>('[name="link-url"]')!.value,
  }));
  const controls = Array.from(element<HTMLFormElement>("bookmark-form").querySelectorAll<HTMLInputElement | HTMLButtonElement>("input, button"));
  saving = true;
  controls.forEach(control => { control.disabled = true; });
  element("save").textContent = "保存しています…";
  formError.textContent = "";
  try {
    const next = validateList({ title: listTitle.value, links });
    const hash = await encodeList(next, format);
    if (revision !== loadRevision) return;
    // Commit the URL before replacing the view, so a failed update keeps the draft.
    history.pushState(null, "", `${location.pathname}${location.search}${hash}`);
    await load();
    if (location.hash !== hash) return;
    message.textContent = `URLに保存しました（${hash.startsWith("#v2=") ? "v2" : "v1"}）。「共有リンクをコピー」から共有できます。`;
    element("copy").focus();
  } catch (error) {
    if (revision !== loadRevision) return;
    formError.textContent = error instanceof Error ? error.message : "保存できませんでした。";
  } finally {
    saving = false;
    controls.forEach(control => { control.disabled = false; });
    element("save").textContent = "保存して一覧を表示";
  }
});

element("copy").addEventListener("click", async () => {
  const url = location.href;
  try {
    await navigator.clipboard.writeText(url);
    element("copy-fallback").hidden = true;
    message.textContent = "共有リンクをコピーしました。";
  } catch {
    const input = element<HTMLInputElement>("share-url");
    input.value = url;
    element("copy-fallback").hidden = false;
    input.focus();
    input.select();
    message.textContent = "表示された共有リンクをコピーしてください。";
  }
});

window.addEventListener("hashchange", load);
window.addEventListener("popstate", load);
load();
