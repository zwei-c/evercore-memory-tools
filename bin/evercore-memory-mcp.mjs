#!/usr/bin/env node

import fs from "node:fs";
import { getEverCoreConfig } from "../src/config.mjs";
import { EverCoreClient } from "../src/http.mjs";
import { callTool as dispatchTool, tools, withSchemaAliases } from "../src/tools.mjs";
import { compactObject } from "../src/utils.mjs";

const config = getEverCoreConfig();
const client = new EverCoreClient(config);
const DEBUG_LOG_PATH = process.env.EVERCORE_MCP_DEBUG_LOG || "/tmp/evercore-memory-mcp.log";

let buffer = Buffer.alloc(0);

process.stdin.resume();

debugLog("startup", {
  pid: process.pid,
  cwd: process.cwd(),
  node: process.version,
  base_url: config.baseUrl,
  default_user_id: config.defaultUserId || null
});

process.stdin.on("data", (chunk) => {
  debugLog("stdin data", { bytes: chunk.length });
  buffer = Buffer.concat([buffer, chunk]);
  readMessages();
});

process.stdin.on("end", () => {
  debugLog("stdin end");
});

process.stdin.on("error", (error) => {
  debugLog("stdin error", { message: error.message, stack: error.stack });
});

process.on("beforeExit", (code) => {
  debugLog("beforeExit", { code });
});

process.on("exit", (code) => {
  debugLog("exit", { code });
});

function readMessages() {
  while (buffer.length > 0) {
    const headerEnd = buffer.indexOf("\r\n\r\n");

    if (headerEnd === -1) {
      const lineEnd = buffer.indexOf("\n");
      if (lineEnd === -1) return;

      const line = buffer.subarray(0, lineEnd).toString("utf8").trim();
      buffer = buffer.subarray(lineEnd + 1);

      if (line.length === 0) continue;
      handleRawMessage(line);
      continue;
    }

    const header = buffer.subarray(0, headerEnd).toString("utf8");
    const match = header.match(/Content-Length:\s*(\d+)/i);
    if (!match) {
      buffer = buffer.subarray(headerEnd + 4);
      continue;
    }

    const contentLength = Number(match[1]);
    const messageStart = headerEnd + 4;
    const messageEnd = messageStart + contentLength;
    if (buffer.length < messageEnd) return;

    const raw = buffer.subarray(messageStart, messageEnd).toString("utf8");
    buffer = buffer.subarray(messageEnd);
    handleRawMessage(raw);
  }
}

function handleRawMessage(raw) {
  let request;

  try {
    request = JSON.parse(raw);
    debugLog(`request ${request.method || "<missing method>"}`, {
      id: request.id ?? null,
      params: request.params ?? null
    });
  } catch (error) {
    debugLog("parse error", { message: error.message, raw: raw.slice(0, 500) });
    sendError(null, -32700, `Parse error: ${error.message}`);
    return;
  }

  handleRequest(request).catch((error) => {
    debugLog("request error", {
      id: request.id ?? null,
      method: request.method,
      message: error.message,
      stack: error.stack
    });
    if (request.id === undefined) return;
    sendError(request.id, -32603, error.message, { stack: process.env.NODE_ENV === "development" ? error.stack : undefined });
  });
}

async function handleRequest(request) {
  if (!request || request.jsonrpc !== "2.0" || typeof request.method !== "string") {
    sendError(request?.id ?? null, -32600, "Invalid Request");
    return;
  }

  if (request.id === undefined) {
    return;
  }

  switch (request.method) {
    case "initialize":
      sendResult(request.id, {
        protocolVersion: request.params?.protocolVersion || "2024-11-05",
        protocol_version: request.params?.protocolVersion || request.params?.protocol_version || "2024-11-05",
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: "evercore-memory",
          version: "0.1.0"
        },
        server_info: {
          name: "evercore-memory",
          version: "0.1.0"
        }
      });
      return;

    case "tools/list":
      sendResult(request.id, { tools: tools.map(withSchemaAliases) });
      return;

    case "tools/call":
      sendResult(request.id, await callTool(request.params || {}));
      return;

    default:
      sendError(request.id, -32601, `Method not found: ${request.method}`);
  }
}

async function callTool(params) {
  const name = params.name;
  const args = params.arguments || {};

  try {
    return toolResult(await dispatchTool(name, args, { client, config }));
  } catch (error) {
    return toolResult({ error: error.message }, true);
  }
}

function toolResult(data, isError = false) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data, null, 2)
      }
    ],
    isError
  };
}

function sendResult(id, result) {
  debugLog(id === null ? "response result" : responseDebugLabel(id, result), { id, result });
  sendMessage({
    jsonrpc: "2.0",
    id,
    result
  });
}

function sendError(id, code, message, data) {
  debugLog("response error", { id, code, message, data });
  sendMessage({
    jsonrpc: "2.0",
    id,
    error: compactObject({
      code,
      message,
      data
    })
  });
}

function sendMessage(message) {
  const json = JSON.stringify(message);
  process.stdout.write(`${json}\n`);
}

function responseDebugLabel(id, result) {
  if (result?.serverInfo || result?.server_info) return "response initialize";
  if (Array.isArray(result?.tools)) return "response tools/list";
  return `response ${id}`;
}

function debugLog(event, data = {}) {
  try {
    fs.appendFileSync(DEBUG_LOG_PATH, `${JSON.stringify({
      ts: new Date().toISOString(),
      event,
      ...data
    })}\n`);
  } catch {
    // MCP stdout must remain protocol-only; ignore debug logging failures.
  }
}
