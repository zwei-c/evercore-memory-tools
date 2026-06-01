#!/usr/bin/env node

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.resolve(__dirname, "../bin/evercore-memory-mcp.mjs");
const child = spawn(process.execPath, [serverPath], {
  stdio: ["pipe", "pipe", "inherit"],
  env: {
    ...process.env,
    EVERCORE_BASE_URL: process.env.EVERCORE_BASE_URL || "https://evercore.example.com",
    EVERCORE_DEFAULT_USER_ID: process.env.EVERCORE_DEFAULT_USER_ID || "codex-smoke-user"
  }
});

const responses = [];
let buffer = Buffer.alloc(0);

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

send({
  jsonrpc: "2.0",
  id: 3,
  method: "tools/call",
  params: {
    name: "evercore_health",
    arguments: {}
  }
});

setTimeout(() => {
  child.kill();
  const initialize = responses.find((message) => message.id === 1);
  const list = responses.find((message) => message.id === 2);
  const health = responses.find((message) => message.id === 3);

  if (!initialize?.result?.serverInfo?.name) {
    fail("initialize response missing serverInfo");
  }

  const toolNames = list?.result?.tools?.map((tool) => tool.name).sort() || [];
  const expected = [
    "evercore_add",
    "evercore_delete",
    "evercore_flush",
    "evercore_health",
    "evercore_search"
  ];

  for (const name of expected) {
    if (!toolNames.includes(name)) {
      fail(`missing tool: ${name}`);
    }
  }

  const healthText = health?.result?.content?.[0]?.text || "";
  if (!healthText.includes("\"status\": \"healthy\"")) {
    fail("evercore_health tool call did not return healthy status");
  }

  console.log("MCP tools smoke test passed.");
  console.log(toolNames.join("\n"));
}, 500);

function send(message) {
  const json = JSON.stringify(message);
  child.stdin.write(`Content-Length: ${Buffer.byteLength(json, "utf8")}\r\n\r\n${json}`);
}

function readMessages() {
  while (buffer.length > 0) {
    const headerEnd = buffer.indexOf("\r\n\r\n");
    if (headerEnd === -1) return;

    const header = buffer.subarray(0, headerEnd).toString("utf8");
    const match = header.match(/Content-Length:\s*(\d+)/i);
    if (!match) return;

    const length = Number(match[1]);
    const start = headerEnd + 4;
    const end = start + length;
    if (buffer.length < end) return;

    const raw = buffer.subarray(start, end).toString("utf8");
    buffer = buffer.subarray(end);
    responses.push(JSON.parse(raw));
  }
}

function fail(message) {
  child.kill();
  console.error(message);
  process.exit(1);
}
