# REST APIを設計する

HTTPとREST API設計を学ぶ、静的な読み物とブラウザ内演習。

## 内容

- HTTPとリソース
- RESTの設計原則
- CRUDとHTTPメソッド
- ステータスコードとエラー表現
- 検索・ソート・ページネーション
- OpenAPIによる契約記述
- 認証・認可とJWT
- 数学的な補足
- インメモリAPIシミュレーター
- 確認問題

APIシミュレーターはブラウザ内で完結し、外部へ通信しない。

## 今後追加予定

次の内容は構想中で、まだ教材およびシミュレーターには実装していない。

- APIバージョニングと後方互換性
- ユニットテスト、統合テスト、契約テスト
- OpenAPI文書と実装の自動照合

## 必要なツール

- Pandoc 3.x
- リポジトリの `npm install` で導入されるTypeScript

## ビルド

```sh
make build
```

Markdown内のLaTeX記法は、Pandocの `--mathml` によりMathMLへ変換される。
