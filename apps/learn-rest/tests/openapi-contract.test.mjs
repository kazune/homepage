import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import vm from "node:vm";

function inlineText(inlines) {
  return inlines.map((inline) => {
    if (inline.t === "Str") return inline.c;
    if (inline.t === "Space" || inline.t === "SoftBreak") return " ";
    if (inline.t === "Code") return inline.c[1];
    return "";
  }).join("");
}

function unwrapMeta(value) {
  if (value === null || typeof value !== "object" || value.t === undefined) {
    return value;
  }
  if (value.t === "MetaMap") {
    return Object.fromEntries(
      Object.entries(value.c).map(([key, child]) => [key, unwrapMeta(child)]),
    );
  }
  if (value.t === "MetaList") return value.c.map(unwrapMeta);
  if (value.t === "MetaBool" || value.t === "MetaString") return value.c;
  if (value.t === "MetaInlines") return inlineText(value.c);
  throw new Error(`Unsupported Pandoc metadata type: ${value.t}`);
}

const appDirectory = fileURLToPath(new URL("..", import.meta.url));
const openapiPath = fileURLToPath(new URL("../src/openapi.yaml", import.meta.url));
const pandocOutput = execFileSync(
  "pandoc",
  [openapiPath, "--from", "markdown", "--to", "json"],
  { encoding: "utf8" },
);
const openapi = Object.fromEntries(
  Object.entries(JSON.parse(pandocOutput).meta).map(
    ([key, value]) => [key, unwrapMeta(value)],
  ),
);

const apiSource = await readFile(`${appDirectory}/dist/assets/api.js`, "utf8");
const context = vm.createContext({ URL, URLSearchParams, Set });
vm.runInContext(
  `${apiSource}\nglobalThis.ApiSimulator = LearnRest.ApiSimulator;`,
  context,
);
const ApiSimulator = context.ApiSimulator;

function resolveReference(value) {
  if (value === null || typeof value !== "object" || !("$ref" in value)) {
    return value;
  }
  assert.match(value.$ref, /^#\//, `外部参照はこのテストの対象外です: ${value.$ref}`);
  return value.$ref.slice(2).split("/").reduce((current, rawPart) => {
    const part = rawPart.replaceAll("~1", "/").replaceAll("~0", "~");
    assert.ok(current && part in current, `参照先がありません: ${value.$ref}`);
    return current[part];
  }, openapi);
}

function validateSchema(rawSchema, value, location = "body") {
  const schema = resolveReference(rawSchema);

  if (schema.enum) {
    assert.ok(schema.enum.includes(value), `${location} must be in enum`);
  }
  if (schema.type === "object") {
    assert.ok(value !== null && typeof value === "object" && !Array.isArray(value), `${location} must be object`);
    for (const name of schema.required ?? []) {
      assert.ok(name in value, `${location}.${name} is required`);
    }
    if (schema.minProperties !== undefined) {
      assert.ok(Object.keys(value).length >= Number(schema.minProperties), `${location} has too few properties`);
    }
    if (schema.additionalProperties === false) {
      for (const name of Object.keys(value)) {
        assert.ok(name in (schema.properties ?? {}), `${location}.${name} is not allowed`);
      }
    }
    for (const [name, childSchema] of Object.entries(schema.properties ?? {})) {
      if (name in value) validateSchema(childSchema, value[name], `${location}.${name}`);
    }
    return;
  }
  if (schema.type === "array") {
    assert.ok(Array.isArray(value), `${location} must be array`);
    value.forEach((item, index) => validateSchema(schema.items, item, `${location}[${index}]`));
    return;
  }
  if (schema.type === "integer") {
    assert.ok(Number.isInteger(value), `${location} must be integer`);
    if (schema.minimum !== undefined) assert.ok(value >= Number(schema.minimum), `${location} is below minimum`);
    if (schema.maximum !== undefined) assert.ok(value <= Number(schema.maximum), `${location} is above maximum`);
    return;
  }
  if (schema.type === "string") {
    assert.equal(typeof value, "string", `${location} must be string`);
    if (schema.minLength !== undefined) assert.ok(value.length >= Number(schema.minLength), `${location} is too short`);
    if (schema.pattern !== undefined) assert.match(value, new RegExp(schema.pattern), `${location} does not match pattern`);
    if (schema.format === "email") assert.match(value, /^\S+@\S+\.\S+$/, `${location} must be email`);
  }
}

function operationFor(pathTemplate, method) {
  const operation = openapi.paths[pathTemplate]?.[method.toLowerCase()];
  assert.ok(operation, `${method} ${pathTemplate} is not defined`);
  return operation;
}

function assertConforms({ pathTemplate, method, path, body, expectedStatus }) {
  const api = new ApiSimulator();
  const response = api.handleRequest(method, path, body);
  assert.equal(response.status, expectedStatus);

  const operation = operationFor(pathTemplate, method);
  const rawResponseContract = operation.responses[String(response.status)];
  assert.ok(rawResponseContract, `${method} ${pathTemplate} does not define ${response.status}`);
  const responseContract = resolveReference(rawResponseContract);
  const mediaType = responseContract.content?.["application/json"];

  if (response.status === 204) {
    assert.equal(response.body, undefined);
    assert.equal(responseContract.content, undefined);
  } else {
    assert.ok(mediaType?.schema, `${method} ${pathTemplate} ${response.status} has no JSON schema`);
    validateSchema(mediaType.schema, response.body);
  }
}

test("OpenAPIの全ローカル参照が解決できる", () => {
  const visit = (value) => {
    if (value === null || typeof value !== "object") return;
    if ("$ref" in value) resolveReference(value);
    for (const child of Object.values(value)) visit(child);
  };
  visit(openapi);
});

test("代表的な実装レスポンスがOpenAPI契約を満たす", () => {
  const cases = [
    { pathTemplate: "/users", method: "GET", path: "/users?per_page=3", expectedStatus: 200 },
    { pathTemplate: "/users", method: "GET", path: "/users?unknown=1", expectedStatus: 400 },
    { pathTemplate: "/users", method: "POST", path: "/users", body: { name: "Dave", email: "dave@example.com" }, expectedStatus: 201 },
    { pathTemplate: "/users", method: "POST", path: "/users", body: {}, expectedStatus: 422 },
    { pathTemplate: "/users/{id}", method: "GET", path: "/users/1", expectedStatus: 200 },
    { pathTemplate: "/users/{id}", method: "GET", path: "/users/999", expectedStatus: 404 },
    { pathTemplate: "/users/{id}", method: "GET", path: "/users/0", expectedStatus: 400 },
    { pathTemplate: "/users/{id}", method: "PUT", path: "/users/1", body: { name: "Alice", email: "alice@example.com" }, expectedStatus: 200 },
    { pathTemplate: "/users/{id}", method: "PATCH", path: "/users/1", body: { name: "Alicia" }, expectedStatus: 200 },
    { pathTemplate: "/users/{id}", method: "PATCH", path: "/users/1", body: {}, expectedStatus: 422 },
    { pathTemplate: "/users/{id}", method: "DELETE", path: "/users/1", expectedStatus: 204 },
  ];

  for (const contractCase of cases) assertConforms(contractCase);
});
