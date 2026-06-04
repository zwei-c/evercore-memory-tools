#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.resolve(__dirname, "../bin/evercore-memory-mcp.mjs");
const debugLogPath = "/tmp/evercore-memory-tools-high-level-debug.log";
fs.rmSync(debugLogPath, { force: true });

const child = spawn(process.execPath, [serverPath], {
  stdio: ["pipe", "pipe", "inherit"],
  env: {
    ...process.env,
    EVERCORE_BASE_URL: process.env.EVERCORE_BASE_URL || "http://localhost:1995",
    EVERCORE_DEFAULT_USER_ID: process.env.EVERCORE_DEFAULT_USER_ID || "codex-smoke-user",
    EVERCORE_MCP_DEBUG_LOG: debugLogPath
  }
});

const responses = [];
let buffer = Buffer.alloc(0);
let nextId = 1;
const timeout = setTimeout(() => fail("timed out waiting for MCP high-level smoke responses"), 20000);

child.stdout.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  readMessages();
});

send("initialize", {
  protocolVersion: "2024-11-05",
  capabilities: {},
  clientInfo: { name: "evercore-memory-tools-high-level-smoke", version: "0.1.0" }
});
notify("notifications/initialized", {});
const scopeId = sendTool("evercore_scope", {});
const ingestId = sendTool("evercore_ingest_codex", { latest: true, dry_run: true });
const spacesId = sendTool("evercore_list_spaces", { include_remote: true });
const missingSourceHash = `missing-${Date.now()}`;
const ingestStatusId = sendTool("evercore_ingest_status", {
  source_hash: missingSourceHash,
  group_id: `coding:smoke:missing:${Date.now()}`
});
const requestStatusId = sendTool("evercore_request_status", {
  source_hash: missingSourceHash,
  group_id: `coding:smoke:missing:${Date.now()}`
});
const disposableGroupId = `coding:smoke:high-level:${Date.now()}`;
const marker = `high-level MCP smoke marker ${Date.now()}`;
const rememberId = sendTool("evercore_remember", {
  content: `Decision: ${marker}`,
  scope: "project",
  category: "verification",
  group_id: disposableGroupId,
  sender_id: "codex-smoke",
  sender_name: "Codex Smoke",
  flush: false
});
let recallId = null;
let historyId = null;
let forgetId = null;

function maybeVerifyResponses() {
  if (!responses.find((message) => message.id === 1)) return;
  if (!responses.find((message) => message.id === scopeId)) return;
  if (!responses.find((message) => message.id === ingestId)) return;
  if (!responses.find((message) => message.id === spacesId)) return;
  if (!responses.find((message) => message.id === ingestStatusId)) return;
  if (!responses.find((message) => message.id === requestStatusId)) return;
  if (responses.find((message) => message.id === rememberId) && recallId === null) {
    recallId = -1;
    historyId = -1;
    setTimeout(() => {
      recallId = sendTool("evercore_recall", {
        query: marker,
        scope: "project",
        group_id: disposableGroupId,
        include_raw: true,
        top_k: 5
      });
      historyId = sendTool("evercore_fetch_history", {
        query: marker,
        scope: "project",
        group_id: disposableGroupId,
        memory_types: ["raw_message"],
        page_size: 5
      });
    }, 1000);
    return;
  }
  if (recallId === -1 || historyId === -1) return;
  if (
    recallId !== null
    && historyId !== null
    && responses.find((message) => message.id === recallId)
    && responses.find((message) => message.id === historyId)
    && forgetId === null
  ) {
    forgetId = sendTool("evercore_forget", {
      group_id: disposableGroupId,
      confirm: "delete"
    });
    return;
  }
  if (forgetId === null || !responses.find((message) => message.id === forgetId)) return;
  clearTimeout(timeout);
  child.kill();
  verifyResponses();
}

function verifyResponses() {
  const scope = parseToolPayload(scopeId);
  if (!scope.group_id?.startsWith("coding:")) {
    fail("evercore_scope did not return a coding group_id");
  }

  const ingest = parseToolPayload(ingestId);
  if (!ingest.dry_run || !ingest.source_hash || !ingest.groupPayload?.messages?.[0]?.sender_id) {
    fail("evercore_ingest_codex dry-run missing expected payload fields");
  }

  const spaces = parseToolPayload(spacesId);
  if (!spaces.spaces?.some((space) => space.group_id?.startsWith("coding:"))) {
    fail("evercore_list_spaces did not return a coding space");
  }

  const ingestStatus = parseToolPayload(ingestStatusId);
  if (ingestStatus.status !== "not_found") {
    fail(`evercore_ingest_status expected not_found, got ${ingestStatus.status}`);
  }

  const requestStatus = parseToolPayload(requestStatusId);
  if (requestStatus.status !== "not_found") {
    fail(`evercore_request_status expected not_found, got ${requestStatus.status}`);
  }

  const remember = parseToolPayload(rememberId);
  if (!remember.ok || remember.group_id !== disposableGroupId) {
    fail("evercore_remember did not write disposable group memory");
  }

  const recall = parseToolPayload(recallId);
  if (!recall.snippets?.some((snippet) => snippet.text.includes(marker))) {
    fail("evercore_recall did not find disposable memory marker");
  }

  const history = parseToolPayload(historyId);
  if (!history.items?.some((item) => item.text.includes(marker))) {
    fail("evercore_fetch_history did not find disposable memory marker");
  }

  const forget = parseToolPayload(forgetId);
  if (!forget.ok) {
    fail("evercore_forget did not delete disposable group");
  }

  console.log("MCP high-level tools smoke test passed.");
  console.log(`scope=${scope.group_id}`);
  console.log(`source_hash=${ingest.source_hash}`);
  console.log(`disposable_group=${disposableGroupId}`);
}

function parseToolPayload(id) {
  const response = responses.find((message) => message.id === id);
  if (response?.result?.isError) {
    fail(`tool call ${id} returned error: ${response.result.content?.[0]?.text}`);
  }
  const text = response?.result?.content?.[0]?.text;
  if (!text) fail(`tool call ${id} missing text result`);
  return JSON.parse(text);
}

function sendTool(name, args) {
  return send("tools/call", { name, arguments: args });
}

function send(method, params) {
  const id = nextId;
  nextId += 1;
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  return id;
}

function notify(method, params) {
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`);
}

function readMessages() {
  while (buffer.length > 0) {
    const lineEnd = buffer.indexOf("\n");
    if (lineEnd === -1) return;
    const line = buffer.subarray(0, lineEnd).toString("utf8").trim();
    buffer = buffer.subarray(lineEnd + 1);
    if (!line) continue;
    responses.push(JSON.parse(line));
    maybeVerifyResponses();
  }
}

function fail(message) {
  clearTimeout(timeout);
  child.kill();
  console.error(message);
  process.exit(1);
}
