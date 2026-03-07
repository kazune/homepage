#!/usr/bin/env node

import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT_DIR = process.cwd();
const APPS_DIR = path.join(ROOT_DIR, "apps");
const OUTPUT_PATH = path.join(ROOT_DIR, "dist", "apps", "index.html");
const BUILD_REPO_URL =
  process.env.BUILD_REPO_URL || "https://github.com/kazune/homepage";
const BUILD_COMMIT_ID = process.env.BUILD_COMMIT_ID || "unknown";

function toRelativePath(rawPath, appName) {
  if (typeof rawPath !== "string" || !rawPath.trim()) {
    return `./${appName}/`;
  }

  const value = rawPath.trim();

  if (value.startsWith("./") || value.startsWith("../")) {
    return value;
  }

  if (value.startsWith("/apps/")) {
    const suffix = value.slice("/apps/".length);
    return `./${suffix}`;
  }

  if (value.startsWith("/")) {
    return `.${value}`;
  }

  return `./${value}`;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function loadApps() {
  const entries = await readdir(APPS_DIR, { withFileTypes: true });
  const appDirs = entries
    .filter((entry) => entry.isDirectory() && entry.name !== "_template")
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const apps = [];

  for (const appName of appDirs) {
    const metaPath = path.join(APPS_DIR, appName, "app.json");
    let raw;
    try {
      raw = await readFile(metaPath, "utf8");
    } catch (error) {
      if (error && error.code === "ENOENT") {
        continue;
      }
      throw error;
    }

    const meta = JSON.parse(raw);
    const title = typeof meta.title === "string" ? meta.title.trim() : "";
    const description =
      typeof meta.description === "string" ? meta.description.trim() : "";

    if (!title || !description) {
      throw new Error(
        `Invalid app.json: ${metaPath} requires non-empty "title" and "description"`
      );
    }

    const appPath = toRelativePath(meta.path, appName);

    apps.push({
      name: appName,
      title,
      description,
      path: appPath,
    });
  }

  return apps;
}

function renderHtml(apps) {
  const items = apps
    .map(
      (app) => `      <li>
        <a class="app-item" href="${escapeHtml(app.path)}">
          <span class="app-title">${escapeHtml(app.title)}</span>
          <p>${escapeHtml(app.description)}</p>
        </a>
      </li>`
    )
    .join("\n");

  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Apps</title>
    <style>
      :root {
        color-scheme: light;
      }
      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        line-height: 1.6;
        color: #1f2937;
        background: #f8fafc;
      }
      main {
        max-width: 720px;
        margin: 0 auto;
        padding: 40px 20px 64px;
      }
      h1 {
        margin: 0 0 20px;
        font-size: 1.8rem;
      }
      .apps {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 12px;
      }
      .app-item {
        display: block;
        border: 1px solid #cbd5e1;
        border-radius: 10px;
        padding: 14px 16px;
        background: #ffffff;
        color: inherit;
        text-decoration: none;
      }
      .app-item:hover {
        border-color: #94a3b8;
      }
      .app-title {
        color: #0f172a;
        font-weight: 700;
      }
      .app-item:hover .app-title {
        text-decoration: underline;
      }
      .app-item p {
        margin: 6px 0 0;
        color: #334155;
      }
      .build-meta {
        margin-top: 28px;
        padding-top: 14px;
        border-top: 1px solid #cbd5e1;
        color: #475569;
        font-size: 0.92rem;
      }
      .build-meta p {
        margin: 6px 0;
      }
      .build-meta a {
        color: #0f172a;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Apps</h1>
      <ul class="apps">
${items}
      </ul>
      <section class="build-meta" aria-label="build metadata">
        <p>Repository: <a href="${escapeHtml(BUILD_REPO_URL)}">${escapeHtml(BUILD_REPO_URL)}</a></p>
        <p>Build commit: <code>${escapeHtml(BUILD_COMMIT_ID)}</code></p>
      </section>
    </main>
  </body>
</html>
`;
}

async function main() {
  const apps = await loadApps();
  const html = renderHtml(apps);
  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, html, "utf8");
  console.log(`generated: ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
