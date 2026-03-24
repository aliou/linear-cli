import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { saveConfig } from "../config.ts";
import { CliError } from "../errors.ts";
import { parseVariables, runGraphql } from "./graphql.ts";

let tempDir: string;
const originalXdgConfigHome = process.env.XDG_CONFIG_HOME;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "linear-cli-graphql-test-"));
  process.env.XDG_CONFIG_HOME = tempDir;
});

afterEach(async () => {
  if (originalXdgConfigHome === undefined) delete process.env.XDG_CONFIG_HOME;
  else process.env.XDG_CONFIG_HOME = originalXdgConfigHome;

  await rm(tempDir, { recursive: true, force: true });
  mock.restore();
});

describe("parseVariables", () => {
  test("returns undefined when omitted", () => {
    expect(parseVariables(undefined)).toBeUndefined();
  });

  test("parses a JSON object", () => {
    expect(parseVariables('{"id":"ENG-123"}')).toEqual({ id: "ENG-123" });
  });

  test("rejects invalid JSON", () => {
    expect(() => parseVariables("{")).toThrow(CliError);
    expect(() => parseVariables("{")).toThrow(
      "Invalid JSON passed to --variables.",
    );
  });

  test("rejects non-object JSON values", () => {
    expect(() => parseVariables('["ENG-123"]')).toThrow(CliError);
    expect(() => parseVariables('["ENG-123"]')).toThrow(
      "GraphQL variables must be a JSON object.",
    );
  });
});

describe("runGraphql", () => {
  test("sends parsed variables to the GraphQL API and prints the response", async () => {
    await saveConfig({ apiToken: "test-api-token", outputFormat: "table" });

    let requestBody:
      | { query?: string; variables?: Record<string, unknown> }
      | undefined;
    const fetchMock = mock(async (_url: string, init?: RequestInit) => {
      requestBody = JSON.parse(String(init?.body));
      return new Response(
        JSON.stringify({ data: { issue: { id: "issue-1", title: "Hello" } } }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    });

    const originalFetch = globalThis.fetch;
    const originalConsoleLog = console.log;
    const logs: string[] = [];
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    console.log = ((value: unknown) => {
      logs.push(String(value));
    }) as typeof console.log;

    try {
      await runGraphql({
        query: "query Issue($id: String!) { issue(id: $id) { id title } }",
        variables: '{"id":"ENG-123"}',
      });

      expect(requestBody).toEqual({
        query: "query Issue($id: String!) { issue(id: $id) { id title } }",
        variables: { id: "ENG-123" },
      });
      expect(logs).toEqual([
        JSON.stringify({ issue: { id: "issue-1", title: "Hello" } }, null, 2),
      ]);
    } finally {
      globalThis.fetch = originalFetch;
      console.log = originalConsoleLog;
    }
  });
});
