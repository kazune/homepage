export type Bookmark = { name: string; url: string };
export type BookmarkList = { title: string; links: Bookmark[] };

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
  return { title: value.title.trim(), links };
}

export function encodeList(list: BookmarkList): string {
  return `#v1=${encodeURIComponent(JSON.stringify(validateList(list)))}`;
}

export function decodeList(hash: string): BookmarkList {
  if (!hash.startsWith("#v1=")) throw new Error("この共有リンクの形式には対応していません。");
  return validateList(JSON.parse(decodeURIComponent(hash.slice(4))));
}
