# homepage

個人ホームページ用のモノレポジトリ。

このリポジトリでは、まず **小さな静的Webアプリ** を複数管理する。
現時点では、大規模アプリやバックエンドを前提にしない。

## 目的

- 個人ホームページ本体を管理する
- 小ネタの静的アプリを `apps/` 配下で管理する
- 公開用成果物を `dist/` に出力する
- Apache から静的ファイルとして配信する

## 前提

- Server: さくらVPS
- OS: Ubuntu
- Web Server: Apache2
- Hosting: static file hosting only

## 基本方針

- まずは小さいアプリを素早く追加できる構成を優先する
- 小さいアプリはこのリポジトリ内で管理する
- URL は `/apps/<app-name>/` に固定する
- 各アプリは独立してビルドできるようにする
- 最終成果物は必ず `dist/` に出力する

## 現時点でやらないこと

- 大規模アプリの開発
- バックエンドの導入
- データベースの導入
- SSR / API サーバーの構築
- diary などの別リポジトリ運用

必要になった時点で別途設計する。

## ディレクトリ構成

```text
homepage/
  site/                     # トップページ・アプリ一覧ページ
  apps/                     # 小アプリ群
    hello-qr/
    word-counter/
  scripts/                  # ビルド補助や一覧生成など
  dist/                     # 公開用成果物
  docs/
    ARCHITECTURE.md
  AGENTS.md
  README.md
```

## URL ルール

* `/` : トップページ
* `/apps/<app-name>/` : 各アプリ
* 公開アプリ一覧: https://kazune.jp/apps/

例:

* `/apps/hello-qr/`
* `/apps/word-counter/`

## アプリ作成ルール

各アプリは少なくとも次を持つこと。

```text
apps/<app-name>/
  src/
  dist/
  README.md
  app.json
```

`app.json` には最低限のメタ情報を持たせる。

例:

```json
{
  "name": "hello-qr",
  "title": "Hello QR",
  "path": "/apps/hello-qr/",
  "description": "テキストからQRコードを生成する小アプリ"
}
```

## ビルド方針

* 各アプリは個別に `dist/` を生成する
* リポジトリ全体の公開物はルートの `dist/` に集約する
* Apache は最終的に `dist/` を配信するだけにする

## 開発ツール

Node.jsとpnpmはVoltaで管理する。
使用するバージョンは `package.json` に固定されている。

依存パッケージは、開発環境とVPSのどちらでも次のコマンドで導入する。

```bash
pnpm install --frozen-lockfile
```

TypeScriptはルートの開発依存として導入され、各Makefileから `pnpm exec` 経由で実行される。

## ルートビルド

```bash
make dist
```

上記で以下を実行する。

* 各アプリの `make build`
* `apps/<app-name>/dist` を `dist/apps/<app-name>/` に集約

## デプロイ（世代管理 + currentリンク）

```bash
make deploy DEPLOY_BASE=/var/www/homepage
```

上記で以下を実行する。

* `dist/` を `/var/www/homepage/releases/yyyyMMdd-HHmmss/` にコピー
* `/var/www/homepage/current` を `releases/yyyyMMdd-HHmmss` へ向けるシンボリックリンクに切り替え

## 将来の拡張

将来的にアプリが大きくなった場合は、次の条件で別リポジトリ化を検討する。

* 更新頻度が独立した
* 依存が重くなった
* バックエンドやDBが必要になった
* 単独で開発した方が明らかに管理しやすい

ただし、現時点では小ネタアプリの追加を最優先とし、このリポジトリ内で完結させる。
