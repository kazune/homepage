---
title: REST APIを設計する
lang: ja
---

# REST APIを設計する {.document-title}

HTTPとRESTを、`users` APIの具体例から学びます。本文だけで基本を理解でき、折りたたみの「数学的に見る」では同じ概念を集合や写像として捉え直せます。

> **この教材の範囲** ここではREST APIの設計に焦点を当てます。RESTは単なるCRUDの対応表ではなく、JWTもRESTの必須要素ではありません。

## 読み方

各章は「直感的な説明 → HTTP例 → 数学的な補足 → 確認問題」の順です。数式を読まなくても次の章へ進めます。

<details class="formal-note">
<summary>数学的に見る: この教材で使う共通記法</summary>

まず、システムを集合で定義します。

- $R$: リソースの集合
- $U$: URIの集合
- $M$: HTTPメソッドの集合
- $P$: 表現（Representation）の集合
- $S$: サーバー状態の集合

この教材ではスキームやホストを固定して捨象し、HTTP APIで扱うURIをパスとクエリパラメータに分解します。厳密には、ここでモデル化しているのはURI全体ではなく、そのパスとクエリ部分です。

- $L$: パスの集合
- $K$: クエリパラメータ名の集合
- $V$: クエリパラメータ値の集合
- $\Theta$: $K$ から $V$ への有限部分写像全体の集合

$$
\Theta = \{\theta \mid \theta: K \rightharpoonup_{\mathrm{fin}} V\}
$$

$$
U = L \times \Theta
$$

したがって、個々のURIを $(l, \theta) \in U$ と表せます。例えば `/users?role=admin` は、パス $l=\mathtt{/users}$ と、$\theta(\mathtt{role})=\mathtt{admin}$ を満たす有限部分写像の組です。

このモデルでは、同じ名前を複数回使う `tag=a&tag=b` を単純化のため扱いません。扱う場合は、値域を有限列の集合 $V^*$ に置き換えます。

さらに、ヘッダー集合を $H$、HTTPステータスコードの集合を $C$ とします。$\operatorname{Option}(P)$ は、表現を持つ場合とボディがない場合を合わせた集合です。

$$
\operatorname{Option}(P) = P \sqcup \{\operatorname{None}\}
$$

リクエスト集合 $Q$ とレスポンス集合 $A$ を、単純化して

$$
Q = M \times U \times H \times \operatorname{Option}(P)
$$

$$
A = C \times H \times \operatorname{Option}(P)
$$

と定義します。HTTPリクエストの処理は、現在の状態とリクエストから次の状態とレスポンスを求める状態遷移

$$
\delta: S \times Q \to S \times A
$$

として扱います。実際のHTTPにはさらに多くの要素がありますが、以降の議論にはこのモデルで十分です。

</details>

# 1. HTTPとリソース

## リソースと表現

リソースは、APIが名前を付けて扱う対象です。ユーザー、記事、注文などが該当します。JSONはリソースそのものではなく、ある時点のリソースを通信するための**表現**です。

```http
GET /users/1 HTTP/1.1
Accept: application/json
```

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "id": 1,
  "name": "Alice",
  "email": "alice@example.com"
}
```

同じユーザーをJSON以外の形式で表現することも理論上は可能です。`Accept` はクライアントが受け取りたい表現を、`Content-Type` は実際の表現形式を示します。

<details class="formal-note">
<summary>数学的に見る: URIは部分写像</summary>

URIからリソースを解決する操作は、サーバー状態 $s \in S$ ごとに

$$
\operatorname{resolve}_s: U \rightharpoonup R
$$

と表せます。すべてのURIにリソースが存在するとは限らないため、全域写像ではなく部分写像です。また、リソースの作成や削除によって定義域が変わるため、写像は状態 $s$ に依存します。未定義の場合、HTTPでは典型的に `404 Not Found` を返します。

</details>

## リクエストの構造

HTTPリクエストの主要部分は次の4つです。

| 部分 | 役割 | 例 |
|---|---|---|
| メソッド | 何をしたいか | `GET` |
| ターゲット | どのリソースか | `/users/1` |
| ヘッダー | 通信上の付加情報 | `Accept: application/json` |
| ボディ | 送信する表現 | `{"name":"Alice"}` |

<div class="misconception">
<strong>よくある誤解:</strong> URIに動詞を並べる必要はありません。`GET /getUser/1` より、メソッドとリソースを分離した `GET /users/1` の方が一貫します。
</div>

# 2. RESTの設計原則

## 統一インターフェース

RESTでは、リソースをURIで識別し、標準化されたHTTPメソッドと表現を通して操作します。API独自の動詞を増やすより、HTTPの意味を利用することが重要です。

## ステートレス

各リクエストは、その処理に必要な情報を自分で持ちます。前のリクエストでだけ渡した暗黙の会話状態に依存しません。

「ステートレス」は、サーバーがデータを保存してはいけないという意味ではありません。ユーザーや注文のような**リソース状態**は保存できます。避けるのは、リクエストの意味を決める隠れた**セッション文脈**への依存です。

```http
GET /users/1 HTTP/1.1
Authorization: Bearer example-token
Accept: application/json
```

このリクエストだけを見て、対象、希望する表現、認証情報を判断できます。

<details class="formal-note">
<summary>数学的に見る: 明示された入力から応答を決める</summary>

共通記法を使うと、リクエスト処理は

$$
\delta: S \times Q \to S \times A
$$

と表されます。ここで $Q$ に含まれない、クライアント固有の隠れた会話状態へ依存しないことがステートレス制約の要点です。

</details>

## その他の制約

- **クライアント・サーバー分離:** UIとデータ管理の責務を分ける
- **キャッシュ可能性:** 応答が再利用可能か明示する
- **階層化システム:** クライアントは途中のプロキシなどを意識しなくてよい
- **Code on Demand:** サーバーからコードを配る任意の制約

# 3. CRUDとHTTPメソッド

## メソッドの使い分け

| 操作 | メソッド | 例 |
|---|---|---|
| 一覧取得 | `GET` | `GET /users` |
| 単体取得 | `GET` | `GET /users/1` |
| 作成 | `POST` | `POST /users` |
| 全体置換 | `PUT` | `PUT /users/1` |
| 部分更新 | `PATCH` | `PATCH /users/1` |
| 削除 | `DELETE` | `DELETE /users/1` |

`PUT` は対象リソースの全体を指定した表現で置き換え、`PATCH` は指定した部分だけを変更する、と区別すると設計が明確になります。

## メソッドの安全性と冪等性

| メソッド | 安全 | 冪等 | 主な意味 |
|---|:---:|:---:|---|
| `GET` | ○ | ○ | リソースの表現を取得する |
| `HEAD` | ○ | ○ | レスポンスボディなしでメタデータを取得する |
| `OPTIONS` | ○ | ○ | 利用可能な通信方法を取得する |
| `POST` | × | × | 対象リソースに応じた処理や作成を依頼する |
| `PUT` | × | ○ | 対象リソース全体を置換する |
| `PATCH` | × | × | 対象リソースを部分的に変更する |
| `DELETE` | × | ○ | 対象リソースを削除する |

この表はHTTPメソッドに定義された性質を示します。個別のAPIが偶然同じ結果を返すかどうかではありません。`PATCH` は更新内容を慎重に設計すれば冪等にできますが、HTTPメソッドとして冪等性は保証されません。

## 安全性と冪等性

**安全なメソッド**は、クライアントがサーバー状態の変更を意図しません。`GET` が代表例です。アクセスログなどの副作用まで禁止する定義ではありません。

**冪等なメソッド**は、同じリクエストを複数回送ったとき、サーバーに対する意図された最終効果が1回の場合と同じです。`PUT` と `DELETE` は冪等になるよう設計します。

<details class="formal-note">
<summary>数学的に見る: 冪等写像</summary>

状態集合 $S$ に対する操作を $f: S \to S$ とすると、冪等性は

$$
f \circ f = f
$$

すなわち、任意の $s \in S$ に対して $f(f(s)) = f(s)$ となる性質です。レスポンスの時刻やログまで同一である必要はなく、比較対象は操作の意図された効果です。

</details>

```http
PUT /users/1 HTTP/1.1
Content-Type: application/json

{
  "name": "Alice",
  "email": "alice@example.com"
}
```

同じ表現による置換を繰り返しても、最終的なユーザーの内容は変わりません。一方、`POST /users` を繰り返すと複数のユーザーが作られ得るため、通常は冪等ではありません。

# 4. ステータスコードとエラー表現

## 結果を二つの層で伝える

HTTPステータスコードは結果の大分類を、レスポンスボディのコードはアプリケーション固有の理由を表します。

| コード | 主な用途 |
|---|---|
| `200 OK` | 取得・更新に成功 |
| `201 Created` | 作成に成功 |
| `204 No Content` | 本文なしで成功 |
| `400 Bad Request` | JSON不正など、リクエストを解釈できない |
| `401 Unauthorized` | 有効な認証情報がない |
| `403 Forbidden` | 認証済みだが操作を許可されない |
| `404 Not Found` | 対象リソースが存在しない |
| `409 Conflict` | 現在の状態と競合する |
| `422 Unprocessable Content` | 形式は読めるが値を処理できない |
| `500 Internal Server Error` | サーバー内部の予期しない失敗 |

```json
{
  "code": "VALIDATION_ERROR",
  "message": "入力内容を確認してください",
  "details": [
    {
      "field": "email",
      "reason": "invalid_format"
    }
  ]
}
```

エラー形式を統一すると、クライアントは文章を解析せず `code` に基づいて処理できます。内部例外やスタックトレースは公開しません。

<details class="formal-note">
<summary>数学的に見る: 結果の直和</summary>

成功結果の集合を $X$、エラーの集合を $E$ とすると、処理結果を直和

$$
X \sqcup E
$$

として扱えます。成功値とエラー値のどちらであるかをステータスコードで識別し、それぞれの詳しい値をボディで返すと考えられます。

</details>

# 5. 検索・ソート・ページネーション

## コレクションをクエリで変換する

一覧取得では、URIのクエリパラメータを使って返す要素と順序を指定します。操作ごとに別のパスを作るより、`/users` という同じコレクションに対する条件として表すと一貫します。

```http
GET /users?q=ali&sort=name&order=asc&page=1&per_page=20 HTTP/1.1
Accept: application/json
```

この教材の仮想APIでは、次のパラメータを扱います。

| パラメータ | 意味 | 例 |
|---|---|---|
| `q` | `name` または `email` の部分一致検索 | `q=ali` |
| `sort` | ソート対象 | `sort=name` |
| `order` | 昇順または降順 | `order=asc` |
| `page` | 1から始まるページ番号 | `page=2` |
| `per_page` | 1ページの最大件数 | `per_page=20` |

パラメータ名やページ番号の起点はHTTPで標準化されていません。API内で一貫させ、OpenAPIなどで契約として明示する必要があります。

## レスポンスにページ情報を含める

```json
{
  "data": [
    {
      "id": 1,
      "name": "Alice",
      "email": "alice@example.com"
    }
  ],
  "meta": {
    "page": 1,
    "perPage": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

現在位置だけでなく総件数や総ページ数も返すと、クライアントがページ操作を構築できます。ただし、巨大なデータに対する総件数の計算は高価な場合があるため、常に必要とは限りません。

<details class="formal-note">
<summary>数学的に見る: 選択・順序付け・部分列</summary>

コレクションを有限列 $X=(x_1,\ldots,x_n)$ とします。検索やフィルタリング条件を述語

$$
\varphi: R \to \{\operatorname{true},\operatorname{false}\}
$$

で表すと、条件に合う要素の列は

$$
\operatorname{filter}_{\varphi}(X)=(x_i \mid \varphi(x_i)=\operatorname{true})
$$

です。ソート条件を全順序 $\preceq$ とすると、これを $\operatorname{sort}_{\preceq}$ で並べ替えます。

1から始まるページ番号を $p$、1ページの件数を $k$ とすると、ページネーションは変換後の列から添字

$$
(p-1)k+1,\ldots,\min(pk,n)
$$

の要素を取り出す操作です。実装順序は原則として、フィルタリング、ソート、ページネーションです。先にページを切り出すと、ページごとに検索結果や順序が変わってしまいます。

</details>

<div class="misconception">
<strong>よくある誤解:</strong> ページネーションだけを指定しても、安定した並び順が自動的に得られるとは限りません。同じソート値を持つ要素がある場合は、`id` などを第2キーにして順序を一意にすると、ページ間の重複や欠落を抑えられます。
</div>

# 6. OpenAPIで契約を記述する

## 実装とは別にインターフェースを記述する

OpenAPIはHTTP APIのインターフェースを、プログラミング言語に依存しない文書として記述する仕様です。人が読むドキュメントだけでなく、入力検証、クライアント生成、モック、テストなどの入力として利用できます。

この教材では、広く対応されているOpenAPI 3.1形式で仮想APIを記述します。

```yaml
openapi: 3.1.0
info:
  title: REST Learn Users API
  version: 1.0.0
paths:
  /users/{id}:
    get:
      operationId: getUser
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
            minimum: 1
      responses:
        "200":
          description: ユーザー
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/User"
        "404":
          $ref: "#/components/responses/NotFound"
```

主な構成要素は次の通りです。

| 要素 | 記述するもの |
|---|---|
| `info` | APIの名前やバージョン |
| `paths` | パスと、そのパスで使えるHTTPメソッド |
| `parameters` | パス、クエリ、ヘッダーなどの入力 |
| `requestBody` | リクエストボディのメディアタイプと構造 |
| `responses` | ステータスコードごとのレスポンス |
| `components` | 再利用するスキーマやレスポンス |

## スキーマを再利用する

```yaml
components:
  schemas:
    User:
      type: object
      additionalProperties: false
      required: [id, name, email]
      properties:
        id:
          type: integer
          minimum: 1
        name:
          type: string
          minLength: 1
        email:
          type: string
          format: email
```

`$ref` を使うと、同じ `User` 定義を一覧取得、単体取得、更新結果から参照できます。実装と仕様の重複を完全になくすものではありませんが、API利用者が参照する契約を一箇所にできます。

<details class="formal-note">
<summary>数学的に見る: 仕様が許す入出力関係</summary>

前章までのリクエスト集合を $Q$、レスポンス集合を $A$ とします。OpenAPI文書が記述する契約を、許可されたリクエストとレスポンスの関係

$$
\mathcal{O} \subseteq Q \times A
$$

として捉えます。状態遷移 $\delta$ に対し、ある状態 $s$ と契約上有効なリクエスト $q$ について

$$
\delta(s,q)=(s',a) \implies (q,a)\in\mathcal{O}
$$

が成り立つなら、実装がその入出力について契約に適合していると考えられます。ただし、OpenAPIだけでは状態に依存するすべての業務規則を表現できません。例えば「同じメールアドレスは登録できない」という制約は、文章や別の形式による補足が必要です。

</details>

<div class="misconception">
<strong>よくある誤解:</strong> OpenAPI文書が存在するだけでは、実装との一致は保証されません。CIで仕様ファイルを検査し、契約テストによって実際のレスポンスを照合して初めて、不一致を継続的に検出できます。
</div>

<details class="formal-note source-note">
<summary>完全なopenapi.yamlを表示</summary>

```{.yaml include="src/openapi.yaml"}
```

</details>

# 7. 認証・認可とJWT

## 認証と認可を分ける

認証（Authentication）は「誰であるか」を確認する処理、認可（Authorization）は「その主体が何をしてよいか」を判定する処理です。認証に成功しても、すべての操作が許可されるわけではありません。

| 段階 | 問い | 失敗時の代表的な応答 |
|---|---|---|
| 認証 | このリクエストの主体は誰か | `401 Unauthorized` |
| 認可 | この主体に操作を許可するか | `403 Forbidden` |

`401 Unauthorized` は名前に反して、有効な認証情報がない場合に使います。HTTP認証を要求する401応答では、利用可能な認証方式を `WWW-Authenticate` ヘッダーで示します。認証情報は有効だが権限がない場合は `403 Forbidden` が対応します。

```http
GET /users/1 HTTP/1.1
Authorization: Bearer eyJhbGciOi...
```

<details class="formal-note">
<summary>数学的に見る: 認証関数と認可関係</summary>

主体の集合を $I$、認証情報の集合を $T$ とします。認証処理を部分性のある関数

$$
\operatorname{authenticate}: T \to \operatorname{Option}(I)
$$

とします。無効な認証情報なら $\operatorname{None}$、有効なら主体 $i\in I$ を返します。

認可規則は、許可された主体、メソッド、URIの関係

$$
\mathcal{A}\subseteq I\times M\times U
$$

として表せます。認証結果が $i$ であるリクエスト $(m,u)$ を許可する条件は

$$
(i,m,u)\in\mathcal{A}
$$

です。このように認証関数と認可関係は別の対象です。

</details>

## JWTの構造

署名付きJWTは、Base64urlで表現された3つの部分をピリオドで連結します。

```text
base64url(header).base64url(payload).base64url(signature)
```

- **Header:** 署名アルゴリズムやトークン種別
- **Payload:** `sub`、`iss`、`aud`、`exp` などのクレーム
- **Signature:** HeaderとPayloadが改変されていないことを検証する値

Base64urlは暗号化ではありません。HeaderとPayloadはトークンを入手した人が読めるため、パスワードや秘密情報を格納してはいけません。

代表的な登録済みクレームには次があります。

| クレーム | 意味 |
|---|---|
| `iss` | 発行者（Issuer） |
| `sub` | 対象となる主体（Subject） |
| `aud` | 想定する受信者（Audience） |
| `exp` | 有効期限（Expiration Time） |
| `nbf` | 使用可能になる時刻（Not Before） |
| `iat` | 発行時刻（Issued At） |
| `jti` | JWTの識別子 |

## 検証で確認するもの

JWTを受け取ったAPIは、少なくとも用途に応じて次を確認します。

1. 許可したアルゴリズムで署名されていること
2. 正しい鍵で署名を検証できること
3. `iss` が期待する発行者であること
4. `aud` に自分自身が含まれること
5. 現在時刻が `exp` と `nbf` の範囲内であること
6. そのトークン種別をこのAPIで受け入れてよいこと

トークンのHeaderに書かれたアルゴリズムを無条件に信用してはいけません。API側が許可するアルゴリズムを設定し、署名とクレームの両方を検証します。

```{=html}
<section class="jwt-tool" aria-labelledby="jwt-tool-title">
  <h2 id="jwt-tool-title">JWTインスペクター</h2>
  <p>HeaderとPayloadをブラウザ内でデコードします。署名の検証は行いません。</p>
  <label>
    <span>JWT</span>
    <textarea data-jwt-input rows="5" spellcheck="false">eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEiLCJyb2xlIjoiYWRtaW4iLCJpc3MiOiJyZXN0LWxlYXJuIiwiYXVkIjoidXNlcnMtYXBpIiwiZXhwIjoxODkzNDU2MDAwfQ.not-a-real-signature</textarea>
  </label>
  <button class="primary-button" type="button" data-decode-jwt>デコード</button>
  <p class="jwt-warning">デコード結果を認証や認可に使用しないでください。</p>
  <pre data-jwt-output aria-live="polite">—</pre>
</section>
```

<div class="misconception">
<strong>よくある誤解:</strong> JWTを使えばサーバーが完全に「状態を持たない」わけではありません。鍵のローテーション、ユーザーの無効化、トークン失効など、運用上の状態管理が必要になる場合があります。また、REST APIにJWTは必須ではありません。
</div>

# 8. APIバージョニングと後方互換性

## バージョンを増やす前に互換性を考える

APIバージョンは、同じ目的を持つ複数の契約を並行して提供する仕組みです。変更のたびにバージョンを増やすのではなく、既存クライアントを壊す変更が避けられない場合に使います。

| 変更 | 一般的な判定 | 注意点 |
|---|---|---|
| 新しいエンドポイントを追加する | 非破壊的 | 既存操作の意味を変えない |
| 任意のリクエスト項目を追加する | 非破壊的 | 省略時の挙動を維持する |
| 必須のリクエスト項目を追加する | 破壊的 | 既存リクエストが検証に失敗する |
| 項目を削除・改名する | 破壊的 | 既存クライアントが値を取得できない |
| 項目の型を変更する | 破壊的 | デシリアライズに失敗し得る |
| 入力の許容値を減らす | 破壊的 | 以前有効だった入力が無効になる |
| レスポンスの列挙値を増やす | 破壊的になり得る | 網羅的に分岐するクライアントが壊れ得る |
| 任意のレスポンス項目を追加する | 条件付き | 未知項目を拒否するクライアントには破壊的 |
| ステータスコードや意味を変える | 破壊的 | 構造が同じでも振る舞いが変わる |

互換性はJSONの形だけでは決まりません。ソート順、丸め方、権限判定など、観測できる意味の変更も契約の変更です。

## バージョンを指定する場所

バージョンの指定方法はHTTPで一つに標準化されていません。APIの利用者、キャッシュ、ルーティング、ドキュメント生成との相性を考えて一つの方式を選び、一貫して使います。

| 方式 | 例 | 特徴 |
|---|---|---|
| パス | `/v1/users` | 発見・ルーティングが容易だが、バージョンごとにURIが変わる |
| 独自ヘッダー | `API-Version: 1` | URIを維持できるが、ブラウザやキャッシュから見えにくい |
| メディアタイプ | `Accept: application/vnd.example.v1+json` | 表現の版を明示できるが、運用とツール設定が複雑 |
| クエリ | `/users?version=1` | 試しやすいが、省略時の規則やキャッシュキーに注意が必要 |

小規模な公開APIでは、明示的で扱いやすいパス方式が現実的です。ただし、URLに版を置くこと自体がRESTの必須条件ではありません。

```http
GET /v1/users/1 HTTP/1.1
Accept: application/json
```

<details class="formal-note">
<summary>数学的に見る: 後方互換性を契約の精緻化として捉える</summary>

APIバージョンの集合を $\mathcal{V}$ とし、バージョン $v\in\mathcal{V}$ が受理するリクエスト集合を $D_v\subseteq Q$ とします。リクエスト $q$ に対して契約が許すレスポンス集合を $A_v(q)\subseteq A$ とします。

新しいバージョン $w$ が古いバージョン $v$ に強い意味で後方互換である条件を

$$
D_v\subseteq D_w
$$

かつ

$$
\forall q\in D_v,\quad A_w(q)\subseteq A_v(q)
$$

と表せます。新しい版は古い入力を引き続き受理し、その入力に対して古い契約が許していないレスポンスを返さない、という条件です。

レスポンス側の包含方向が逆に見える点が重要です。新しい契約が返し得る結果を増やすと、古いクライアントが想定していない結果が現れるためです。実務では、クライアントが観測する項目や副作用も含めて互換性を評価します。

</details>

## 廃止から停止までを分ける

古いバージョンを即座に停止せず、次の順序で移行します。

1. 後継バージョンと移行手順を公開する
2. OpenAPIで対象操作を `deprecated: true` にする
3. レスポンスで廃止予定を通知する
4. 利用状況を計測し、利用者を移行する
5. 告知した日時以降に停止する

```http
HTTP/1.1 200 OK
Deprecation: @1798761600
Sunset: Thu, 01 Jul 2027 00:00:00 GMT
Link: <https://example.com/migrations/v2>; rel="deprecation"
Content-Type: application/json
```

`Deprecation` はそのリソースが非推奨になる、またはなったことを示します。`Sunset` は応答しなくなる可能性のある将来日時を示します。非推奨になっても直ちに挙動は変えず、停止日と移行先を別途伝えます。

<div class="misconception">
<strong>よくある誤解:</strong> `v2` を作っただけでは移行は完了しません。旧版の利用者、期限、移行手順、監視、停止後の応答まで決めることがバージョニング運用です。
</div>

# APIシミュレーター

次の仮想APIはブラウザ内だけで動き、外部へ通信しません。メソッドとパスを変え、操作前後の状態を比較してください。`GET /users?q=ali&sort=name&order=asc&page=1&per_page=10` のような一覧クエリも試せます。

```{=html}
<section class="simulator" aria-labelledby="simulator-title">
  <h2 id="simulator-title">リクエストを試す</h2>
  <form class="request-form" data-request-form>
    <label>
      <span>メソッド</span>
      <select data-method>
        <option>GET</option>
        <option>POST</option>
        <option>PUT</option>
        <option>PATCH</option>
        <option>DELETE</option>
      </select>
    </label>
    <label class="path-field">
      <span>パス</span>
      <input data-path value="/users" spellcheck="false" />
    </label>
    <label class="body-field">
      <span>JSONボディ</span>
      <textarea data-request-body rows="6" spellcheck="false">{
  "name": "Bob",
  "email": "bob@example.com"
}</textarea>
    </label>
    <div class="form-actions">
      <button class="primary-button" type="submit">送信</button>
      <button class="secondary-button" type="button" data-reset>状態を初期化</button>
    </div>
  </form>
  <p class="request-hint" data-request-hint>GETではボディを使用しません。</p>
  <div class="response-summary" data-response-summary aria-live="polite">まだ送信していません。</div>
  <div class="output-grid">
    <section>
      <h3>レスポンス</h3>
      <pre data-response>—</pre>
    </section>
    <section>
      <h3>現在の状態</h3>
      <pre data-state></pre>
    </section>
  </div>
</section>
```

# 確認問題

```{=html}
<section class="quiz" data-quiz>
  <h2>問1</h2>
  <p>同じ内容の <code>PUT /users/1</code> を2回送ると、最終的なリソース状態は1回送った場合と同じでした。この性質は何ですか。</p>
  <div class="quiz-options">
    <button type="button" data-quiz-option>安全性</button>
    <button type="button" data-quiz-option data-correct="true">冪等性</button>
    <button type="button" data-quiz-option>ステートレス</button>
  </div>
  <p class="quiz-feedback" data-quiz-feedback aria-live="polite"></p>
</section>

<section class="quiz" data-quiz>
  <h2>問2</h2>
  <p>存在しない <code>GET /users/999</code> に最も適切なステータスコードはどれですか。</p>
  <div class="quiz-options">
    <button type="button" data-quiz-option>400</button>
    <button type="button" data-quiz-option data-correct="true">404</button>
    <button type="button" data-quiz-option>500</button>
  </div>
  <p class="quiz-feedback" data-quiz-feedback aria-live="polite"></p>
</section>

<section class="quiz" data-quiz>
  <h2>問3</h2>
  <p>RESTにおける「ステートレス」の説明として適切なのはどれですか。</p>
  <div class="quiz-options quiz-options-long">
    <button type="button" data-quiz-option>サーバーはデータを保存してはならない</button>
    <button type="button" data-quiz-option data-correct="true">各リクエストが処理に必要な文脈を持つ</button>
    <button type="button" data-quiz-option>すべてのメソッドが安全でなければならない</button>
  </div>
  <p class="quiz-feedback" data-quiz-feedback aria-live="polite"></p>
</section>

<section class="quiz" data-quiz>
  <h2>問4</h2>
  <p>OpenAPI文書について正しい説明はどれですか。</p>
  <div class="quiz-options quiz-options-long">
    <button type="button" data-quiz-option>文書を作れば実装との一致も自動的に保証される</button>
    <button type="button" data-quiz-option data-correct="true">APIの入出力契約を記述できるが、実装との一致には検査が必要である</button>
    <button type="button" data-quiz-option>サーバー内部の業務ロジックをすべて記述する仕様である</button>
  </div>
  <p class="quiz-feedback" data-quiz-feedback aria-live="polite"></p>
</section>

<section class="quiz" data-quiz>
  <h2>問5</h2>
  <p>有効な認証情報はあるものの、対象リソースを操作する権限がない場合の代表的なステータスコードはどれですか。</p>
  <div class="quiz-options">
    <button type="button" data-quiz-option>401</button>
    <button type="button" data-quiz-option data-correct="true">403</button>
    <button type="button" data-quiz-option>404</button>
  </div>
  <p class="quiz-feedback" data-quiz-feedback aria-live="polite"></p>
</section>

<section class="quiz" data-quiz>
  <h2>問6</h2>
  <p>JWTのHeaderとPayloadをBase64urlデコードできたとき、何が確認できますか。</p>
  <div class="quiz-options quiz-options-long">
    <button type="button" data-quiz-option data-correct="true">内容を読めるだけで、署名の正当性は確認できない</button>
    <button type="button" data-quiz-option>正しい発行者が作ったことを確認できる</button>
    <button type="button" data-quiz-option>有効期限内であることを確認できる</button>
  </div>
  <p class="quiz-feedback" data-quiz-feedback aria-live="polite"></p>
</section>

<section class="quiz" data-quiz>
  <h2>問7</h2>
  <p>既存APIへの変更として、一般に破壊的なのはどれですか。</p>
  <div class="quiz-options quiz-options-long">
    <button type="button" data-quiz-option>新しいエンドポイントを追加する</button>
    <button type="button" data-quiz-option data-correct="true">既存リクエストに必須項目を追加する</button>
    <button type="button" data-quiz-option>既存の任意項目を維持したまま説明を詳しくする</button>
  </div>
  <p class="quiz-feedback" data-quiz-feedback aria-live="polite"></p>
</section>

<section class="quiz" data-quiz>
  <h2>問8</h2>
  <p>古いAPIが非推奨になったが、まだ利用可能であることを通知する目的に対応するヘッダーはどれですか。</p>
  <div class="quiz-options">
    <button type="button" data-quiz-option data-correct="true">Deprecation</button>
    <button type="button" data-quiz-option>Content-Encoding</button>
    <button type="button" data-quiz-option>Retry-After</button>
  </div>
  <p class="quiz-feedback" data-quiz-feedback aria-live="polite"></p>
</section>
```

# まとめ

- リソースと、そのJSON表現を区別する
- URIはリソースを識別し、HTTPメソッドは操作の意味を伝える
- ステートレスとは、各リクエストが必要な文脈を持つこと
- 安全性と冪等性は異なる性質
- HTTPステータスとアプリケーション固有エラーを組み合わせる

次の段階では、ユニットテスト、統合テスト、契約テストへ進みます。
