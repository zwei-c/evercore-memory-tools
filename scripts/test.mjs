#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { renderBriefing } from "../src/briefing.mjs";
import { getCodexIngestStatus, parseCodexSession, summarizeToolOutput } from "../src/codex-ingest.mjs";
import { buildHistoryPayload, fetchHistory, normalizeHistoryItems } from "../src/history.mjs";
import { listKnownSpaces } from "../src/spaces.mjs";
import { getRequestStatus } from "../src/status.mjs";
import { detectSensitiveText, assertSafeToStore } from "../src/safety.mjs";
import { scopeFromRemote } from "../src/scope.mjs";
import { callTool, tools } from "../src/tools.mjs";

await test("scopeFromRemote resolves common remotes", () => {
  assert.equal(scopeFromRemote("git@github.com:example-org/workspace.git"), "github:example-org/workspace");
  assert.equal(scopeFromRemote("https://github.com/example-org/workspace.git"), "github:example-org/workspace");
  assert.equal(scopeFromRemote("git@gitlab.example.com:example-org/evercore-memory-tools.git"), "gitlab:example-org/evercore-memory-tools");
  assert.equal(scopeFromRemote("not a url"), "git:not-a-url");
});

await test("sensitive detection blocks likely secrets", () => {
  assert.equal(detectSensitiveText("API_TOKEN=abc123").length, 1);
  assert.throws(() => assertSafeToStore("Authorization: Bearer abc.def.ghi"), /sensitive/);
  assert.doesNotThrow(() => assertSafeToStore("Decision: use project-scoped memory."));
});

await test("Codex parser skips bootstrap and summarizes huge tool output", () => {
  const file = writeFixture([
    { timestamp: "2026-06-04T00:00:00.000Z", type: "session_meta", payload: { id: "fixture", cwd: "/tmp", timestamp: "2026-06-04T00:00:00.000Z" } },
    { timestamp: "2026-06-04T00:00:01.000Z", type: "response_item", payload: { type: "message", role: "user", content: [{ type: "text", text: "# AGENTS.md instructions\n<environment_context>" }] } },
    { timestamp: "2026-06-04T00:00:02.000Z", type: "response_item", payload: { type: "message", role: "user", content: [{ type: "text", text: "Implement the plan." }] } },
    { timestamp: "2026-06-04T00:00:03.000Z", type: "response_item", payload: { type: "message", role: "assistant", phase: "final", content: [{ type: "output_text", text: "Implemented." }] } },
    { timestamp: "2026-06-04T00:00:04.000Z", type: "response_item", payload: { type: "function_call_output", output: "Process exited with code 0 Original token count: 9000 Output: huge" } }
  ]);
  const parsed = parseCodexSession(file);
  assert.deepEqual(parsed.userRequests, ["Implement the plan."]);
  assert.deepEqual(parsed.assistantFinals, ["Implemented."]);
  assert.match(parsed.toolOutcomes[0], /output omitted/);
  assert.equal(summarizeToolOutput("Process exited with code 1 Output: error"), "Process exited with code 1 Output: error");
});

await test("briefing renderer keeps stable empty headings", () => {
  const markdown = renderBriefing({
    scope: { repo_root: "/tmp/repo" },
    groupId: "coding:local:repo",
    results: [["Conventions", []], ["Recent Decisions", ["Use MCP-first workflow."]]]
  });
  assert.match(markdown, /## Conventions/);
  assert.match(markdown, /No matching memory found/);
  assert.match(markdown, /Use MCP-first workflow/);
});

await test("history helpers build scoped payloads and normalize result buckets", () => {
  const payload = buildHistoryPayload({ group_id: "coding:test", memory_type: "episodic_memory", page_size: 7 }, {});
  assert.equal(payload.memory_type, "episodic_memory");
  assert.deepEqual(payload.filters, { group_id: "coding:test" });
  assert.equal(payload.page_size, 7);

  const items = normalizeHistoryItems({ data: { raw_messages: [{ memory_id: "m1", content: "hello raw", group_id: "coding:test" }] } }, "raw_message");
  assert.equal(items.length, 1);
  assert.equal(items[0].type, "raw_message");
  assert.equal(items[0].text, "hello raw");
});

await test("fetchHistory uses search fallback for raw_message history", async () => {
  const calls = [];
  const result = await fetchHistory({
    memory_types: ["raw_message"],
    group_id: "coding:test",
    query: "marker",
    page_size: 5
  }, {
    async search(payload) {
      calls.push(payload);
      return { data: { raw_messages: [{ memory_id: "raw-1", content: "marker memory", group_id: payload.filters.group_id }] } };
    }
  }, {});

  assert.equal(calls[0].memory_types[0], "raw_message");
  assert.equal(calls[0].query, "marker");
  assert.equal(result.items[0].text, "marker memory");
  assert.match(result.limitations[0], /search/);
});

await test("listKnownSpaces keeps local/config spaces when remote listing is unavailable", async () => {
  const spaces = await listKnownSpaces({
    cwd: process.cwd(),
    group_id: "coding:configured"
  }, {
    async listGroups() {
      throw new Error("HTTP 405");
    }
  });

  assert.ok(spaces.spaces.some((space) => space.source === "current_repo" && space.group_id.startsWith("coding:")));
  assert.ok(spaces.spaces.some((space) => space.source === "env" && space.group_id === "coding:configured"));
  assert.match(spaces.limitations[0], /unavailable/);
});

await test("status helpers infer not_found and raw_found without dedicated lifecycle endpoint", async () => {
  const notFound = await getCodexIngestStatus({ source_hash: "missing", group_id: "coding:test" }, {
    async search() {
      return { data: { raw_messages: [], episodes: [], agent_memory: { cases: [] } } };
    }
  });
  assert.equal(notFound.status, "not_found");

  let searchCount = 0;
  const rawFound = await getCodexIngestStatus({ source_hash: "present", group_id: "coding:test" }, {
    async search() {
      searchCount += 1;
      if (searchCount === 1) {
        return { data: { raw_messages: [{ memory_id: "raw-1", content: "Source Hash: present" }] } };
      }
      return { data: { episodes: [], agent_memory: { cases: [] } } };
    }
  });
  assert.equal(rawFound.status, "raw_found");

  const requestFound = await getRequestStatus({ request_id: "req-1", group_id: "coding:test" }, {
    async search() {
      return { data: { raw_messages: [{ memory_id: "raw-1", content: "req-1 accepted" }] } };
    }
  }, {});
  assert.equal(requestFound.status, "accepted");
});

await test("evercore_recall rewrites category queries", async () => {
  const seen = [];
  const result = await callTool("evercore_recall", {
    query: "transcript ingestion",
    group_id: "coding:test",
    categories: ["decision"],
    include_raw: true
  }, {
    config: {},
    client: {
      async search(payload) {
        seen.push(payload);
        return { data: { raw_messages: [{ memory_id: "raw-1", content: payload.query }] } };
      }
    }
  });

  assert.equal(result.effective_query, "category:decision transcript ingestion");
  assert.equal(seen[0].query, "category:decision transcript ingestion");
  assert.equal(seen[1].query, "category:decision transcript ingestion");
});

await test("tool schemas include low-level and high-level tools without unsupported combinators", () => {
  const names = tools.map((tool) => tool.name).sort();
  for (const expected of [
    "evercore_health",
    "evercore_search",
    "evercore_add",
    "evercore_flush",
    "evercore_delete",
    "evercore_scope",
    "evercore_remember",
    "evercore_recall",
    "evercore_briefing",
    "evercore_forget",
    "evercore_ingest_codex",
    "evercore_list_spaces",
    "evercore_fetch_history",
    "evercore_ingest_status",
    "evercore_request_status"
  ]) {
    assert.ok(names.includes(expected), `missing tool ${expected}`);
  }
  assert.equal(findUnsupportedSchemaKeyword(tools), null);
});

console.log("Tests passed.");

async function test(name, callback) {
  try {
    await callback();
  } catch (error) {
    console.error(`Test failed: ${name}`);
    throw error;
  }
}

function writeFixture(records) {
  const file = path.join(os.tmpdir(), `evercore-memory-tools-fixture-${Date.now()}.jsonl`);
  fs.writeFileSync(file, `${records.map((record) => JSON.stringify(record)).join("\n")}\n`);
  return file;
}

function findUnsupportedSchemaKeyword(value, pathLabel = "tools") {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = findUnsupportedSchemaKeyword(value[index], `${pathLabel}[${index}]`);
      if (found) return found;
    }
    return null;
  }
  for (const key of ["oneOf", "anyOf", "allOf"]) {
    if (Object.hasOwn(value, key)) return `${pathLabel}.${key}`;
  }
  for (const [key, child] of Object.entries(value)) {
    const found = findUnsupportedSchemaKeyword(child, `${pathLabel}.${key}`);
    if (found) return found;
  }
  return null;
}
