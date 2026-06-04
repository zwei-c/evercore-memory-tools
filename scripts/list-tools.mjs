#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.resolve(__dirname, "../bin/evercore-memory-mcp.mjs");
const debugLogPath = "/tmp/evercore-memory-tools-list-tools-debug.log";
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
let sawHeaderFramedResponse = false;
const timeout = setTimeout(() => {
  child.kill();
  verifyResponses();
}, 5000);

child.stdout.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  readMessages();
});

send({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: {
      name: "evercore-memory-tools-smoke",
      version: "0.1.0"
    }
  }
});

send({
  jsonrpc: "2.0",
  method: "notifications/initialized",
  params: {}
});

send({
  jsonrpc: "2.0",
  id: 2,
  method: "tools/list",
  params: {}
});

function maybeVerifyResponses() {
  const initialize = responses.find((message) => message.id === 1);
  const list = responses.find((message) => message.id === 2);

  if (initialize && list) {
    clearTimeout(timeout);
    child.kill();
    verifyResponses();
  }
}

function verifyResponses() {
  const initialize = responses.find((message) => message.id === 1);
  const list = responses.find((message) => message.id === 2);

  if (!initialize?.result?.serverInfo?.name) {
    fail("initialize response missing serverInfo");
  }
  if (!initialize?.result?.server_info?.name) {
    fail("initialize response missing server_info");
  }

  const toolNames = list?.result?.tools?.map((tool) => tool.name).sort() || [];
  const expected = [
    "evercore_add",
    "evercore_briefing",
    "evercore_delete",
    "evercore_flush",
    "evercore_health",
    "evercore_forget",
    "evercore_fetch_history",
    "evercore_ingest_codex",
    "evercore_ingest_status",
    "evercore_list_spaces",
    "evercore_recall",
    "evercore_remember",
    "evercore_request_status",
    "evercore_scope",
    "evercore_search"
  ];

  for (const name of expected) {
    if (!toolNames.includes(name)) {
      fail(`missing tool: ${name}`);
    }
  }
  for (const tool of list?.result?.tools || []) {
    if (!tool.inputSchema) {
      fail(`missing inputSchema for tool: ${tool.name}`);
    }
    if (!tool.input_schema) {
      fail(`missing input_schema for tool: ${tool.name}`);
    }
  }

  const unsupportedSchemaKeyword = findUnsupportedSchemaKeyword(list?.result?.tools || []);
  if (unsupportedSchemaKeyword) {
    fail(`unsupported schema keyword found: ${unsupportedSchemaKeyword}`);
  }

  if (sawHeaderFramedResponse) {
    fail("server used Content-Length framing; expected newline-delimited JSON");
  }
  const debugLog = fs.readFileSync(debugLogPath, "utf8");
  if (!debugLog.includes("request initialize") || !debugLog.includes("response initialize")) {
    fail("debug log missing initialize handshake entries");
  }

  console.log("MCP tools smoke test passed.");
  console.log(toolNames.join("\n"));
}

function send(message) {
  const json = JSON.stringify(message);
  child.stdin.write(`${json}\n`);
}

function readMessages() {
  while (buffer.length > 0) {
    const headerEnd = buffer.indexOf("\r\n\r\n");
    if (headerEnd === -1) {
      const lineEnd = buffer.indexOf("\n");
      if (lineEnd === -1) return;

      const line = buffer.subarray(0, lineEnd).toString("utf8").trim();
      buffer = buffer.subarray(lineEnd + 1);
      if (line.length === 0) continue;

      responses.push(JSON.parse(line));
      maybeVerifyResponses();
      continue;
    }

    const header = buffer.subarray(0, headerEnd).toString("utf8");
    const match = header.match(/Content-Length:\s*(\d+)/i);
    if (!match) return;
    sawHeaderFramedResponse = true;

    const length = Number(match[1]);
    const start = headerEnd + 4;
    const end = start + length;
    if (buffer.length < end) return;

    const raw = buffer.subarray(start, end).toString("utf8");
    buffer = buffer.subarray(end);
    responses.push(JSON.parse(raw));
    maybeVerifyResponses();
  }
}

function findUnsupportedSchemaKeyword(value, path = "tools") {
  if (!value || typeof value !== "object") {
    return null;
  }

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = findUnsupportedSchemaKeyword(value[index], `${path}[${index}]`);
      if (found) return found;
    }
    return null;
  }

  for (const key of ["oneOf", "anyOf", "allOf"]) {
    if (Object.hasOwn(value, key)) {
      return `${path}.${key}`;
    }
  }

  for (const [key, child] of Object.entries(value)) {
    const found = findUnsupportedSchemaKeyword(child, `${path}.${key}`);
    if (found) return found;
  }

  return null;
}

function fail(message) {
  child.kill();
  console.error(message);
  process.exit(1);
}
