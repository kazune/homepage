namespace LearnRest {
  export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

  export type User = {
    id: number;
    name: string;
    email: string;
  };

  export type ApiState = {
    users: User[];
  };

  export type ApiResponse = {
    status: number;
    statusText: string;
    headers?: Record<string, string>;
    body?: unknown;
    effect: string;
  };

  type UserInput = Partial<Pick<User, "name" | "email">>;

  const initialState: ApiState = {
    users: [
      { id: 1, name: "Alice", email: "alice@example.com" },
      { id: 2, name: "Bob", email: "bob@example.com" },
      { id: 3, name: "Carol", email: "carol@example.com" },
      { id: 4, name: "Alicia", email: "alicia@example.com" },
    ],
  };

  function cloneState(source: ApiState): ApiState {
    return { users: source.users.map((user) => ({ ...user })) };
  }

  function errorResponse(
    status: number,
    statusText: string,
    code: string,
    message: string,
  ): ApiResponse {
    return {
      status,
      statusText,
      body: { code, message },
      effect: "状態は変更されませんでした。",
    };
  }

  function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  function parseUserInput(value: unknown): UserInput | null {
    if (!isRecord(value)) {
      return null;
    }

    const allowedProperties = new Set(["name", "email"]);
    if (Object.keys(value).some((name) => !allowedProperties.has(name))) {
      return null;
    }

    const input: UserInput = {};
    if (typeof value.name === "string") {
      input.name = value.name.trim();
    }
    if (typeof value.email === "string") {
      input.email = value.email.trim();
    }
    return input;
  }

  function validateUserInput(input: UserInput, requireAll: boolean): ApiResponse | null {
    if (requireAll && (!input.name || !input.email)) {
      return errorResponse(422, "Unprocessable Content", "VALIDATION_ERROR", "nameとemailを指定してください。");
    }
    if (!requireAll && input.name === undefined && input.email === undefined) {
      return errorResponse(422, "Unprocessable Content", "VALIDATION_ERROR", "nameまたはemailを1つ以上指定してください。");
    }
    if (input.name !== undefined && input.name.length === 0) {
      return errorResponse(422, "Unprocessable Content", "VALIDATION_ERROR", "nameを空にはできません。");
    }
    if (input.email !== undefined && !/^\S+@\S+\.\S+$/.test(input.email)) {
      return errorResponse(422, "Unprocessable Content", "VALIDATION_ERROR", "emailの形式が正しくありません。");
    }
    return null;
  }

  function positiveInteger(value: string | null, fallback: number): number | null {
    if (value === null || value === "") {
      return fallback;
    }
    if (!/^\d+$/.test(value)) {
      return null;
    }
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  }

  export class ApiSimulator {
    private state: ApiState = cloneState(initialState);

    reset(): void {
      this.state = cloneState(initialState);
    }

    snapshot(): ApiState {
      return cloneState(this.state);
    }

    private listUsers(parameters: URLSearchParams): ApiResponse {
      const allowedParameters = new Set(["q", "sort", "order", "page", "per_page"]);
      const unknownParameter = Array.from(parameters.keys()).find(
        (name) => !allowedParameters.has(name),
      );
      if (unknownParameter) {
        return errorResponse(400, "Bad Request", "UNKNOWN_QUERY_PARAMETER", `query parameter ${unknownParameter} は定義されていません。`);
      }

      const duplicateParameter = Array.from(allowedParameters).find(
        (name) => parameters.getAll(name).length > 1,
      );
      if (duplicateParameter) {
        return errorResponse(400, "Bad Request", "DUPLICATE_QUERY_PARAMETER", `query parameter ${duplicateParameter} は複数指定できません。`);
      }

      const sort = parameters.get("sort") ?? "id";
      const order = parameters.get("order") ?? "asc";
      const page = positiveInteger(parameters.get("page"), 1);
      const perPage = positiveInteger(parameters.get("per_page"), 10);

      if (!["id", "name", "email"].includes(sort)) {
        return errorResponse(400, "Bad Request", "INVALID_SORT", "sortにはid、name、emailを指定してください。");
      }
      if (order !== "asc" && order !== "desc") {
        return errorResponse(400, "Bad Request", "INVALID_ORDER", "orderにはascまたはdescを指定してください。");
      }
      if (page === null || perPage === null || perPage > 100) {
        return errorResponse(400, "Bad Request", "INVALID_PAGINATION", "pageは1以上、per_pageは1以上100以下の整数で指定してください。");
      }

      const query = (parameters.get("q") ?? "").trim().toLocaleLowerCase();
      const filtered = this.state.users.filter((user) =>
        query === "" ||
        user.name.toLocaleLowerCase().includes(query) ||
        user.email.toLocaleLowerCase().includes(query),
      );

      const sorted = [...filtered].sort((left, right) => {
        const leftValue = left[sort as keyof User];
        const rightValue = right[sort as keyof User];
        const comparison = typeof leftValue === "number" && typeof rightValue === "number"
          ? leftValue - rightValue
          : String(leftValue).localeCompare(String(rightValue), "ja");
        const ordered = order === "asc" ? comparison : -comparison;
        return ordered || left.id - right.id;
      });

      const total = sorted.length;
      const totalPages = total === 0 ? 0 : Math.ceil(total / perPage);
      const start = (page - 1) * perPage;
      return {
        status: 200,
        statusText: "OK",
        headers: { "Content-Type": "application/json" },
        body: {
          data: sorted.slice(start, start + perPage),
          meta: { page, perPage, total, totalPages },
        },
        effect: "フィルタリング、ソート、ページネーションの順に適用しました。状態は変更していません。",
      };
    }

    handleRequest(method: HttpMethod, path: string, rawBody: unknown): ApiResponse {
      let url: URL;
      try {
        url = new URL(path, "https://learn-rest.invalid");
      } catch {
        return errorResponse(400, "Bad Request", "INVALID_URI", "URIを解釈できません。");
      }

      const normalizedPath = url.pathname.replace(/\/+$/, "") || "/";
      const match = normalizedPath.match(/^\/users(?:\/([^/]+))?$/);
      if (!match) {
        return errorResponse(404, "Not Found", "ROUTE_NOT_FOUND", "このパスは定義されていません。");
      }

      const idPart = match[1];
      if (
        idPart !== undefined &&
        (!/^\d+$/.test(idPart) || !Number.isSafeInteger(Number(idPart)) || Number(idPart) < 1)
      ) {
        return errorResponse(400, "Bad Request", "INVALID_USER_ID", "user idは1以上の整数で指定してください。");
      }
      const id = idPart === undefined ? null : Number(idPart);

      if (url.search !== "" && (id !== null || method !== "GET")) {
        return errorResponse(400, "Bad Request", "QUERY_NOT_ALLOWED", "この操作ではクエリパラメータを使用できません。");
      }
      if (method === "GET" && id === null) {
        return this.listUsers(url.searchParams);
      }
      if (method === "GET" && id !== null) {
        const user = this.state.users.find((candidate) => candidate.id === id);
        return user
          ? {
              status: 200,
              statusText: "OK",
              headers: { "Content-Type": "application/json" },
              body: user,
              effect: "GETは安全なメソッドです。状態を変更していません。",
            }
          : errorResponse(404, "Not Found", "USER_NOT_FOUND", `user ${id} は存在しません。`);
      }
      if (method === "POST" && id === null) {
        const input = parseUserInput(rawBody);
        if (!input) {
          return errorResponse(422, "Unprocessable Content", "VALIDATION_ERROR", "JSONオブジェクトを指定してください。");
        }
        const validationError = validateUserInput(input, true);
        if (validationError) {
          return validationError;
        }
        const nextId = Math.max(0, ...this.state.users.map((user) => user.id)) + 1;
        const user: User = { id: nextId, name: input.name!, email: input.email! };
        this.state.users.push(user);
        return {
          status: 201,
          statusText: "Created",
          headers: { "Content-Type": "application/json", Location: `/users/${nextId}` },
          body: user,
          effect: "新しいリソースを作成しました。POSTは通常、冪等ではありません。",
        };
      }
      if ((method === "PUT" || method === "PATCH") && id !== null) {
        const index = this.state.users.findIndex((candidate) => candidate.id === id);
        if (index < 0) {
          return errorResponse(404, "Not Found", "USER_NOT_FOUND", `user ${id} は存在しません。`);
        }
        const input = parseUserInput(rawBody);
        if (!input) {
          return errorResponse(422, "Unprocessable Content", "VALIDATION_ERROR", "JSONオブジェクトを指定してください。");
        }
        const validationError = validateUserInput(input, method === "PUT");
        if (validationError) {
          return validationError;
        }
        const current = this.state.users[index];
        this.state.users[index] = method === "PUT"
          ? { id, name: input.name!, email: input.email! }
          : { ...current, ...input, id };
        return {
          status: 200,
          statusText: "OK",
          headers: { "Content-Type": "application/json" },
          body: this.state.users[index],
          effect: method === "PUT"
            ? "リソース全体を置換しました。同じPUTの反復は同じ最終状態になります。"
            : "指定されたフィールドだけを更新しました。",
        };
      }
      if (method === "DELETE" && id !== null) {
        const index = this.state.users.findIndex((candidate) => candidate.id === id);
        if (index < 0) {
          return errorResponse(404, "Not Found", "USER_NOT_FOUND", `user ${id} はすでに存在しません。`);
        }
        this.state.users.splice(index, 1);
        return {
          status: 204,
          statusText: "No Content",
          effect: "リソースを削除しました。DELETEは冪等になるよう設計します。",
        };
      }
      return errorResponse(405, "Method Not Allowed", "METHOD_NOT_ALLOWED", `${method} はこのパスでは使用できません。`);
    }
  }
}
