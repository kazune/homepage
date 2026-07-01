import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const apiSource = await readFile(
  new URL("../dist/assets/api.js", import.meta.url),
  "utf8",
);

const context = vm.createContext({ URL, URLSearchParams, Set });
vm.runInContext(
  `${apiSource}\nglobalThis.ApiSimulator = RestLearn.ApiSimulator;`,
  context,
);

const ApiSimulator = context.ApiSimulator;

test("GETは状態を変更せず、検索とページネーションを適用する", () => {
  const api = new ApiSimulator();
  const before = JSON.stringify(api.snapshot());
  const response = api.handleRequest(
    "GET",
    "/users?q=ali&sort=name&per_page=1",
  );

  assert.equal(response.status, 200);
  assert.equal(response.body.data.length, 1);
  assert.equal(response.body.meta.total, 2);
  assert.equal(JSON.stringify(api.snapshot()), before);
});

test("POSTからGETまでの一連の操作でリソースを作成できる", () => {
  const api = new ApiSimulator();
  const created = api.handleRequest("POST", "/users", {
    name: "Dave",
    email: "dave@example.com",
  });
  const fetched = api.handleRequest("GET", created.headers.Location);

  assert.equal(created.status, 201);
  assert.equal(created.headers.Location, "/users/5");
  assert.equal(fetched.status, 200);
  assert.equal(fetched.body.name, "Dave");
});

test("PUTは同じリクエストを反復しても状態が変わらない", () => {
  const api = new ApiSimulator();
  const body = { name: "Alice Updated", email: "alice@example.com" };

  api.handleRequest("PUT", "/users/1", body);
  const afterFirst = JSON.stringify(api.snapshot());
  api.handleRequest("PUT", "/users/1", body);

  assert.equal(JSON.stringify(api.snapshot()), afterFirst);
});

test("DELETEの反復ではレスポンスが異なっても最終状態は同じ", () => {
  const api = new ApiSimulator();
  const first = api.handleRequest("DELETE", "/users/1");
  const afterFirst = JSON.stringify(api.snapshot());
  const second = api.handleRequest("DELETE", "/users/1");

  assert.equal(first.status, 204);
  assert.equal(second.status, 404);
  assert.equal(JSON.stringify(api.snapshot()), afterFirst);
});

test("不正な入力と未定義クエリを4xxで拒否する", () => {
  const api = new ApiSimulator();

  assert.equal(api.handleRequest("POST", "/users", {}).status, 422);
  assert.equal(api.handleRequest("GET", "/users?unknown=1").status, 400);
  assert.equal(api.handleRequest("GET", "/users/0").status, 400);
});
