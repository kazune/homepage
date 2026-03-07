# Analog Clock

現在時刻をアナログ時計で表示するだけの小さな静的アプリです。

## URL

`/apps/analog-clock/`

## 構成

```text
src/index.html
src/style.css
src/main.ts        # アプリロジック（ソース）
Makefile
dist/index.html    # 配信用HTML
dist/assets/main.js
dist/assets/style.css
```

## ビルド

```bash
make build
```

`dist/` に配信用ファイルを出力します。
