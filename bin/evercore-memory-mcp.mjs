#!/usr/bin/env node

import fs from "node:fs";

const DEFAULT_BASE_URL = "http://localhost:1995";
const BASE_URL = (process.env.EVERCORE_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
const API_BASE_URL = `${BASE_URL}/api/v1`;
const API_KEY = process.env.EVERCORE_API_KEY || "";
const DEFAULT_USER_ID = process.env.EVERCORE_DEFAULT_USER_ID || "";
const DEFAULT_SESSION_ID = process.env.EVERCORE_DEFAULT_SESSION_ID || "";
const DEBUG_LOG_PATH = process.env.EVERCORE_MCP_DEBUG_LOG || "/tmp/evercore-memory-mcp.log";

const tools = [
  {
    name: "evercore_health",
    description: "Check whether the configured EverCore service is healthy.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "evercore_search",
    description: "Search EverCore memories. Use before answering when prior user/project context may matter.",
    inputSchema: {
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string", minLength: 1 },
        method: {
          type: "string",
          enum: ["keyword", "vector", "hybrid", "agentic"],
          default: "hybrid"
        },
        memory_types: {
          type: "array",
          items: { type: "string", enum: ["episodic_memory", "profile", "raw_message", "agent_memory"] },
          default: ["episodic_memory", "profile"]
        },
        filters: {
          type: "object",
          description: "EverCore filter DSL. If omitted and EVERCORE_DEFAULT_USER_ID is set, user_id is injected.",
          additionalProperties: true
        },
        top_k: { type: "integer", minimum: -1, maximum: 100, default: 5 },
        include_original_data: { type: "boolean", default: false }
      },
      additionalProperties: false
    }
  },
  {
    name: "evercore_add",
    description: "Store personal memory messages in EverCore after a useful interaction.",
    inputSchema: {
      type: "object",
      required: ["messages"],
      properties: {
        user_id: {
          type: "string",
          description: "EverCore user id. Optional only when EVERCORE_DEFAULT_USER_ID is configured."
        },
        session_id: { type: "string" },
        async_mode: { type: "boolean" },
        messages: {
          type: "array",
          minItems: 1,
          maxItems: 500,
          items: {
            type: "object",
            required: ["role", "content"],
            properties: {
              role: { type: "string", enum: ["user", "assistant"] },
              timestamp: {
                type: "integer",
                description: "Unix timestamp in milliseconds. Defaults to Date.now() when omitted."
              },
              content: { type: "string" },
              message_id: { type: "string" },
              sender_id: { type: "string" },
              sender_name: { type: "string" }
            },
            additionalProperties: true
          }
        }
      },
      additionalProperties: false
    }
  },
  {
    name: "evercore_flush",
    description: "Trigger EverCore personal memory extraction for a user/session boundary.",
    inputSchema: {
      type: "object",
      properties: {
        user_id: {
          type: "string",
          description: "EverCore user id. Optional only when EVERCORE_DEFAULT_USER_ID is configured."
        },
        session_id: { type: "string" }
      },
      additionalProperties: false
    }
  },
  {
    name: "evercore_delete",
    description: "Soft delete EverCore memories by memory_id or by user/session filters. Use carefully.",
    inputSchema: {
      type: "object",
      properties: {
        memory_id: { type: "string" },
        user_id: { type: "string" },
        group_id: { type: "string" },
        session_id: { type: "string" },
        sender_id: { type: "string" }
      },
      additionalProperties: false
    }
  }
];

let buffer = Buffer.alloc(0);

process.stdin.resume();

debugLog("startup", {
  pid: process.pid,
  cwd: process.cwd(),
  node: process.version,
  base_url: BASE_URL,
  default_user_id: DEFAULT_USER_ID || null
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
    switch (name) {
      case "evercore_health":
        return toolResult(await evercoreRequest("/health", { apiPrefix: false }));

      case "evercore_search":
        return toolResult(await evercoreRequest("/memories/search", {
          method: "POST",
          body: buildSearchPayload(args)
        }));

      case "evercore_add":
        return toolResult(await evercoreRequest("/memories", {
          method: "POST",
          body: buildAddPayload(args)
        }));

      case "evercore_flush":
        return toolResult(await evercoreRequest("/memories/flush", {
          method: "POST",
          body: buildScopedPayload(args)
        }));

      case "evercore_delete":
        return toolResult(await evercoreRequest("/memories/delete", {
          method: "POST",
          body: buildDeletePayload(args),
          expectNoContent: true
        }));

      default:
        return toolResult({ error: `Unknown tool: ${name}` }, true);
    }
  } catch (error) {
    return toolResult({ error: error.message }, true);
  }
}

function buildSearchPayload(args) {
  if (!args.query || typeof args.query !== "string") {
    throw new Error("evercore_search requires a non-empty query");
  }

  const filters = args.filters && Object.keys(args.filters).length > 0
    ? args.filters
    : defaultUserFilter();

  if (DEFAULT_SESSION_ID && !filters.session_id) {
    filters.session_id = DEFAULT_SESSION_ID;
  }

  return {
    query: args.query,
    method: args.method || "hybrid",
    memory_types: args.memory_types || ["episodic_memory", "profile"],
    filters,
    top_k: args.top_k ?? 5,
    include_original_data: args.include_original_data ?? false
  };
}

function buildAddPayload(args) {
  const user_id = args.user_id || DEFAULT_USER_ID;
  const session_id = args.session_id || DEFAULT_SESSION_ID;
  if (!user_id) {
    throw new Error("evercore_add requires user_id or EVERCORE_DEFAULT_USER_ID");
  }
  if (!Array.isArray(args.messages) || args.messages.length === 0) {
    throw new Error("evercore_add requires at least one message");
  }

  const now = Date.now();
  const messages = args.messages.map((message, index) => ({
    ...message,
    timestamp: message.timestamp ?? now + index
  }));

  return compactObject({
    user_id,
    session_id: session_id || undefined,
    async_mode: args.async_mode,
    messages
  });
}

function buildScopedPayload(args) {
  const user_id = args.user_id || DEFAULT_USER_ID;
  const session_id = args.session_id || DEFAULT_SESSION_ID;
  if (!user_id) {
    throw new Error("This operation requires user_id or EVERCORE_DEFAULT_USER_ID");
  }

  return compactObject({
    user_id,
    session_id: session_id || undefined
  });
}

function buildDeletePayload(args) {
  if (args.memory_id) {
    return { memory_id: args.memory_id };
  }

  const user_id = args.user_id || DEFAULT_USER_ID;
  const session_id = args.session_id || DEFAULT_SESSION_ID;
  const payload = compactObject({
    user_id,
    group_id: args.group_id,
    session_id: session_id || undefined,
    sender_id: args.sender_id
  });

  if (!payload.user_id && !payload.group_id) {
    throw new Error("evercore_delete requires memory_id, user_id, group_id, or EVERCORE_DEFAULT_USER_ID");
  }

  return payload;
}

function defaultUserFilter() {
  if (!DEFAULT_USER_ID) {
    throw new Error("Search requires filters or EVERCORE_DEFAULT_USER_ID");
  }

  return { user_id: DEFAULT_USER_ID };
}

async function evercoreRequest(path, options = {}) {
  const method = options.method || "GET";
  const url = `${options.apiPrefix === false ? BASE_URL : API_BASE_URL}${path}`;
  const headers = {
    Accept: "application/json"
  };

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (API_KEY) {
    headers.Authorization = `Bearer ${API_KEY}`;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined
  });

  if (options.expectNoContent && response.status === 204) {
    return { status: 204, ok: true };
  }

  const text = await response.text();
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { text };
    }
  }

  if (!response.ok) {
    throw new Error(`EverCore ${method} ${path} failed with HTTP ${response.status}: ${JSON.stringify(data)}`);
  }

  return data;
}

function compactObject(object) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
}

function withSchemaAliases(tool) {
  return {
    ...tool,
    input_schema: tool.inputSchema
  };
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
