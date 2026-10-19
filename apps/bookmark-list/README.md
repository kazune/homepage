# 共有ブックマーク

一覧の名前と、各リンクの名前・URLをまとめて共有する静的アプリ。
公開パス：`/apps/bookmark-list/`

1. 一覧の名前と各リンクの名前・URLを入力する。
2. 「保存して一覧を表示」で現在のURLに保存する。
3. 「共有リンクをコピー」でURLを送り、相手も同じ一覧を開く。

リンクは別タブで開く。URLはHTTP/HTTPSに対応。
一覧は編集・リンク追加・削除が可能。編集は保存時に新しいURLへ反映される。
以前に共有したURLの内容はそのまま残る。

全情報は `#v1=<URLエンコードされたJSON>` に保存する。
localStorageやサーバーへの保存、外部API、追加依存は使用しない。
Clipboard APIが使えない場合は、手動コピー用のURL入力欄を表示する。

## ビルド・確認

ルートで依存関係を導入後：

```sh
make -C apps/bookmark-list build
node --test apps/bookmark-list/tests/data.test.mjs
```

ルートの `make dist` でアプリ一覧の生成と `dist/apps/bookmark-list/` への集約も行う。
ローカルでは `dist/` を静的配信し、`/apps/bookmark-list/` を開く。
