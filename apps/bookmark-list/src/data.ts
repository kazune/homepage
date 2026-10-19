export type Bookmark = { name: string; url: string };
export type BookmarkList = { title: string; links: Bookmark[]; updatedAt: string };
export type SaveFormat = "v1" | "v2" | "auto";

export function normalizeUrl(value: string): string {
  const url = new URL(value.trim());
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("URLは http:// または https:// で始めてください。");
  }
  return url.href;
}

export function validateList(value: unknown): BookmarkList {
  if (!value || typeof value !== "object" || !("title" in value) || typeof value.title !== "string" || !value.title.trim() || !("links" in value) || !Array.isArray(value.links) || value.links.length === 0) {
    throw new Error("一覧の名前と、1件以上のリンクを入力してください。");
  }
  const links = value.links.map((link: unknown): Bookmark => {
    if (!link || typeof link !== "object" || !("name" in link) || typeof link.name !== "string" || !link.name.trim() || !("url" in link) || typeof link.url !== "string") {
      throw new Error("各リンクの名前とURLを入力してください。");
    }
    return { name: link.name.trim(), url: normalizeUrl(link.url) };
  });
  const timestamp = "updatedAt" in value ? value.updatedAt : undefined;
  if (typeof timestamp !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(timestamp) || !Number.isFinite(Date.parse(timestamp)) || new Date(timestamp).toISOString() !== timestamp) {
    throw new Error("有効な最終更新日時が必要です。");
  }
  return { title: value.title.trim(), links, updatedAt: timestamp };
}

export function prepareListForSave(draft: Omit<BookmarkList, "updatedAt">, previous: BookmarkList | null, now = new Date()): BookmarkList {
  const next = validateList({ ...draft, updatedAt: now.toISOString() });
  const unchanged = previous && next.title === previous.title && next.links.length === previous.links.length
    && next.links.every((link, index) => link.name === previous.links[index].name && link.url === previous.links[index].url);
  return unchanged ? { ...next, updatedAt: previous.updatedAt } : next;
}

export async function encodeList(list: BookmarkList, format: SaveFormat = "auto"): Promise<string> {
  const json = JSON.stringify(validateList(list));
  const v1 = `#v1=${encodeURIComponent(json)}`;
  if (format === "v1") return v1;
  if (format !== "auto" && format !== "v2") throw new Error("保存形式を選んでください。");
  if (typeof CompressionStream === "undefined" || typeof DecompressionStream === "undefined") {
    if (format === "auto") return v1;
    throw new Error("このブラウザはv2の圧縮形式に対応していません。自動またはv1を選んでください。");
  }
  try {
    const stream = new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"));
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    const binary = Array.from(bytes, byte => String.fromCharCode(byte)).join("");
    const base64url = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const v2 = `#v2=${base64url}`;
    return format === "v2" || v2.length < v1.length ? v2 : v1;
  } catch (error) {
    if (format === "auto") return v1;
    throw error;
  }
}

export async function decodeList(hash: string): Promise<BookmarkList> {
  if (hash.startsWith("#v1=")) {
    return validateList(JSON.parse(decodeURIComponent(hash.slice(4))));
  }
  if (!hash.startsWith("#v2=")) throw new Error("この共有リンクの形式には対応していません。");
  if (typeof DecompressionStream === "undefined") {
    throw new Error("このブラウザはv2の共有リンクに対応していません。対応ブラウザで開いてください。");
  }
  const payload = hash.slice(4);
  if (!/^[A-Za-z0-9_-]+$/.test(payload) || payload.length % 4 === 1) {
    throw new Error("共有リンクの圧縮データが不正です。");
  }
  const bytes = Uint8Array.from(atob(payload.replace(/-/g, "+").replace(/_/g, "/")), char => char.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  const json = await new Response(stream).text();
  return validateList(JSON.parse(json));
}
