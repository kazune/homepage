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

# APIシミュレーター

次の仮想APIはブラウザ内だけで動き、外部へ通信しません。メソッドとパスを変え、操作前後の状態を比較してください。

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
```

# まとめ

- リソースと、そのJSON表現を区別する
- URIはリソースを識別し、HTTPメソッドは操作の意味を伝える
- ステートレスとは、各リクエストが必要な文脈を持つこと
- 安全性と冪等性は異なる性質
- HTTPステータスとアプリケーション固有エラーを組み合わせる

次の段階では、検索・ソート・ページネーション、OpenAPI、認証と認可、バージョニング、テストへ進みます。
