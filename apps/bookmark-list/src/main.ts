import { decodeList, encodeList, validateList, type Bookmark, type BookmarkList } from "./data.js";

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
    const url = document.createElement("span");
    url.className = "bookmark-url";
    url.textContent = link.url;
    const icon = document.createElement("span");
    icon.className = "open-icon";
    icon.textContent = "↗";
    icon.setAttribute("aria-hidden", "true");
    text.append(name, url);
    anchor.append(text, icon);
    item.append(anchor);
    list.append(item);
  });
  element("copy-fallback").hidden = true;
  viewer.hidden = false;
  editor.hidden = true;
}

function load(): void {
  current = null;
  const loadError = element("load-error");
  loadError.hidden = true;
  message.textContent = "";
  element("page-title").textContent = "共有ブックマーク";
  document.title = "共有ブックマーク";
  if (location.hash) {
    try {
      current = decodeList(location.hash);
    } catch {
      loadError.textContent = "共有リンクを読み込めませんでした。URLが途中で切れていないか確認してください。新しい一覧を作ることもできます。";
      loadError.hidden = false;
    }
  }
  if (current) showViewer();
  else showEditor();
}

element("add").addEventListener("click", () => addRow(undefined, true));
element("edit").addEventListener("click", () => {
  showEditor();
  listTitle.focus();
});
element("cancel").addEventListener("click", showViewer);

element<HTMLFormElement>("bookmark-form").addEventListener("submit", event => {
  event.preventDefault();
  const links = Array.from(rows.querySelectorAll("fieldset"), row => ({
    name: row.querySelector<HTMLInputElement>('[name="link-name"]')!.value,
    url: row.querySelector<HTMLInputElement>('[name="link-url"]')!.value,
  }));
  try {
    const next = validateList({ title: listTitle.value, links });
    const hash = encodeList(next);
    // Commit the URL before replacing the view, so a failed update keeps the draft.
    history.pushState(null, "", `${location.pathname}${location.search}${hash}`);
    load();
    message.textContent = "URLに保存しました。「共有リンクをコピー」から共有できます。";
    element("copy").focus();
  } catch (error) {
    formError.textContent = error instanceof Error ? error.message : "保存できませんでした。";
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
