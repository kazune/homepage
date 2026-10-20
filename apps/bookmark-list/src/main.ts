import { DataSizeError, decodeList, encodeList, prepareListForSave, type Bookmark, type BookmarkList, type SaveFormat } from "./data.js";

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
  const name = row.querySelector<HTMLInputElement>('[name="link-title"]')!;
  const url = row.querySelector<HTMLInputElement>('[name="link-url"]')!;
  name.value = link.name;
  url.value = link.url;
  for (const direction of ["up", "down"] as const) {
    const button = row.querySelector<HTMLButtonElement>(`.move-${direction}`)!;
    button.addEventListener("click", () => {
      const neighbor = direction === "up" ? row.previousElementSibling : row.nextElementSibling;
      if (!neighbor) return;
      if (direction === "up") rows.insertBefore(row, neighbor);
      else rows.insertBefore(neighbor, row);
      numberRows();
      // Keep keyboard focus on the moved row, including at either end.
      (button.disabled ? row.querySelector<HTMLButtonElement>(direction === "up" ? ".move-down" : ".move-up")! : button).focus();
    });
  }
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
  const items = rows.querySelectorAll("fieldset");
  items.forEach((row, index) => {
    row.querySelector("legend")!.textContent = `リンク ${index + 1}`;
    row.querySelector(".remove")!.setAttribute("aria-label", `リンク${index + 1}を削除`);
    const up = row.querySelector<HTMLButtonElement>(".move-up")!;
    const down = row.querySelector<HTMLButtonElement>(".move-down")!;
    up.setAttribute("aria-label", `リンク${index + 1}を上へ移動`);
    down.setAttribute("aria-label", `リンク${index + 1}を下へ移動`);
    up.disabled = saving || index === 0;
    down.disabled = saving || index === items.length - 1;
  });
}

function showEditor(): void {
  element("intro").hidden = false;
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
  element("intro").hidden = true;
  element("page-title").textContent = current.title;
  document.title = `${current.title} | 共有ブックマーク`;
  element("link-count").textContent = `${current.links.length}件のリンク`;
  const updatedAt = element<HTMLTimeElement>("updated-at");
  updatedAt.dateTime = current.updatedAt;
  updatedAt.textContent = `最終更新：${new Date(current.updatedAt).toLocaleString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}`;
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
      loadError.textContent = error instanceof DataSizeError || (typeof DecompressionStream === "undefined" && hash.startsWith("#v2=") && error instanceof Error)
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
element("new-list").addEventListener("click", async () => {
  history.pushState(null, "", `${location.pathname}${location.search}`);
  await load();
  listTitle.focus();
});

element<HTMLFormElement>("bookmark-form").addEventListener("submit", async event => {
  event.preventDefault();
  if (saving) return;
  const revision = loadRevision;
  const format = document.querySelector<HTMLInputElement>('input[name="save-format"]:checked')!.value as SaveFormat;
  const links = Array.from(rows.querySelectorAll("fieldset"), row => ({
    name: row.querySelector<HTMLInputElement>('[name="link-title"]')!.value,
    url: row.querySelector<HTMLInputElement>('[name="link-url"]')!.value,
  }));
  const controls = Array.from(element<HTMLFormElement>("bookmark-form").querySelectorAll<HTMLInputElement | HTMLButtonElement>("input, button"));
  saving = true;
  controls.forEach(control => { control.disabled = true; });
  element("save").textContent = "保存しています…";
  formError.textContent = "";
  try {
    const next = prepareListForSave({ title: listTitle.value, links }, current);
    const hash = await encodeList(next, format);
    if (revision !== loadRevision) return;
    const detail = current === null
      ? "URLをコピーして共有できます。"
      : hash === location.hash
        ? "内容・共有URLに変更はありませんでした。"
        : "新しいURLをコピーして共有してください。";
    // Commit the URL before replacing the view, so a failed update keeps the draft.
    history.pushState(null, "", `${location.pathname}${location.search}${hash}`);
    await load();
    if (location.hash !== hash) return;
    message.textContent = `保存しました（${hash.startsWith("#v2=") ? "v2" : "v1"}）。${detail}`;
    element("copy").focus();
  } catch (error) {
    if (revision !== loadRevision) return;
    formError.textContent = error instanceof Error ? error.message : "保存できませんでした。";
  } finally {
    saving = false;
    controls.forEach(control => { control.disabled = false; });
    numberRows();
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
