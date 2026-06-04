import { buildBriefing } from "./briefing.mjs";
import { getCodexIngestStatus, ingestCodexSession } from "./codex-ingest.mjs";
import { fetchHistory } from "./history.mjs";
import { normalizeSearchSnippets } from "./memory-text.mjs";
import {
  buildAddPayload,
  buildDeletePayload,
  buildScopedPayload,
  buildSearchPayload
} from "./payloads.mjs";
import { resolveScope } from "./scope.mjs";
import { assertSafeToStore } from "./safety.mjs";
import { listKnownSpaces } from "./spaces.mjs";
import { getRequestStatus } from "./status.mjs";
import { compactObject } from "./utils.mjs";

export const tools = [
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
    description: "Search EverCore memories. Low-level debug/compatibility tool; prefer evercore_recall for daily workflow.",
    inputSchema: {
      type: "object",
      required: ["query"],
      properties: lowLevelSearchProperties(),
      additionalProperties: false
    }
  },
  {
    name: "evercore_add",
    description: "Store personal memory messages. Low-level debug/compatibility tool; prefer evercore_remember.",
    inputSchema: {
      type: "object",
      required: ["messages"],
      properties: {
        user_id: { type: "string" },
        session_id: { type: "string" },
        async_mode: { type: "boolean" },
        messages: messageArraySchema(["user", "assistant"])
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
        user_id: { type: "string" },
        session_id: { type: "string" }
      },
      additionalProperties: false
    }
  },
  {
    name: "evercore_delete",
    description: "Soft delete EverCore memories by memory_id or by user/session filters. Low-level; prefer evercore_forget.",
    inputSchema: {
      type: "object",
      properties: deleteProperties(),
      additionalProperties: false
    }
  },
  {
    name: "evercore_scope",
    description: "Resolve the current repo into a stable coding memory scope/group_id.",
    inputSchema: {
      type: "object",
      properties: {
        cwd: { type: "string" }
      },
      additionalProperties: false
    }
  },
  {
    name: "evercore_remember",
    description: "Store durable project, user, or agent memory with safety checks and optional flush.",
    inputSchema: {
      type: "object",
      required: ["content"],
      properties: {
        content: { type: "string", minLength: 1 },
        scope: { type: "string", enum: ["project", "user", "agent"], default: "project" },
        category: { type: "string", enum: ["decision", "convention", "bugfix", "roadmap", "preference", "blocker", "verification", "note"], default: "note" },
        importance: { type: "number", minimum: 0, maximum: 1, default: 0.5 },
        group_id: { type: "string" },
        user_id: { type: "string" },
        session_id: { type: "string" },
        sender_id: { type: "string", default: "codex" },
        sender_name: { type: "string", default: "Codex" },
        flush: { type: "boolean", default: true }
      },
      additionalProperties: false
    }
  },
  {
    name: "evercore_recall",
    description: "Recall normalized user/project/agent memory snippets for daily agent context restore.",
    inputSchema: {
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string", minLength: 1 },
        scope: { type: "string", enum: ["project", "user", "all"], default: "project" },
        group_id: { type: "string" },
        user_id: { type: "string" },
        method: { type: "string", enum: ["keyword", "vector", "hybrid", "agentic"] },
        categories: {
          type: "array",
          items: { type: "string", enum: ["decision", "convention", "bugfix", "roadmap", "preference", "blocker", "verification", "note"] }
        },
        top_k: { type: "integer", minimum: 1, maximum: 50, default: 5 },
        include_raw: { type: "boolean", default: false },
        include_raw_result: { type: "boolean", default: false }
      },
      additionalProperties: false
    }
  },
  {
    name: "evercore_briefing",
    description: "Render a session-start Markdown memory briefing for the current repo scope.",
    inputSchema: {
      type: "object",
      properties: {
        cwd: { type: "string" },
        group_id: { type: "string" },
        user_id: { type: "string" },
        top_k: { type: "integer", minimum: 1, maximum: 20, default: 5 },
        format: { type: "string", enum: ["markdown"], default: "markdown" }
      },
      additionalProperties: false
    }
  },
  {
    name: "evercore_forget",
    description: "Safely delete a specific memory or explicit test scope. Scope deletes require confirm='delete'.",
    inputSchema: {
      type: "object",
      properties: {
        ...deleteProperties(),
        confirm: { type: "string", enum: ["delete"] }
      },
      additionalProperties: false
    }
  },
  {
    name: "evercore_ingest_codex",
    description: "Build or write a Codex rollout transcript summary. Defaults to dry-run unless dry_run=false is explicit.",
    inputSchema: {
      type: "object",
      properties: {
        latest: { type: "boolean", default: true },
        file: { type: "string" },
        dry_run: { type: "boolean", default: true },
        force: { type: "boolean", default: false },
        group_id: { type: "string" },
        user_id: { type: "string" },
        session_id: { type: "string" },
        flush: { type: "boolean", default: true },
        cwd: { type: "string" }
      },
      additionalProperties: false
    }
  },
  {
    name: "evercore_list_spaces",
    description: "List known project memory spaces from the current repo, environment, and remote groups when supported.",
    inputSchema: {
      type: "object",
      properties: {
        cwd: { type: "string" },
        include_remote: { type: "boolean", default: true },
        include_config: { type: "boolean", default: true },
        include_current: { type: "boolean", default: true },
        group_id: { type: "string" }
      },
      additionalProperties: false
    }
  },
  {
    name: "evercore_fetch_history",
    description: "Fetch a limited memory timeline for a project, user, or session.",
    inputSchema: {
      type: "object",
      properties: {
        scope: { type: "string", enum: ["project", "user", "all"], default: "project" },
        group_id: { type: "string" },
        user_id: { type: "string" },
        session_id: { type: "string" },
        memory_types: {
          type: "array",
          items: { type: "string", enum: ["raw_message", "episodic_memory", "profile", "agent_case", "agent_skill"] },
          default: ["raw_message", "episodic_memory", "agent_case", "agent_skill"]
        },
        query: { type: "string" },
        page: { type: "integer", minimum: 1, default: 1 },
        page_size: { type: "integer", minimum: 1, maximum: 100, default: 20 },
        rank_by: { type: "string", default: "timestamp" },
        rank_order: { type: "string", enum: ["asc", "desc"], default: "desc" },
        include_raw_result: { type: "boolean", default: false }
      },
      additionalProperties: false
    }
  },
  {
    name: "evercore_ingest_status",
    description: "Check whether a Codex rollout source_hash appears to have been ingested.",
    inputSchema: {
      type: "object",
      properties: {
        latest: { type: "boolean", default: true },
        file: { type: "string" },
        source_hash: { type: "string" },
        group_id: { type: "string" },
        user_id: { type: "string" },
        cwd: { type: "string" }
      },
      additionalProperties: false
    }
  },
  {
    name: "evercore_request_status",
    description: "Infer limited request status from request_id or source_hash. This is not a full lifecycle tracker.",
    inputSchema: {
      type: "object",
      properties: {
        request_id: { type: "string" },
        source_hash: { type: "string" },
        group_id: { type: "string" },
        user_id: { type: "string" },
        session_id: { type: "string" },
        latest: { type: "boolean" },
        file: { type: "string" }
      },
      additionalProperties: false
    }
  }
];

export async function callTool(name, args, context) {
  const { client, config } = context;

  switch (name) {
    case "evercore_health":
      return client.health();
    case "evercore_search":
      return client.search(buildSearchPayload(args, config));
    case "evercore_add":
      return client.add(buildAddPayload(args, config));
    case "evercore_flush":
      return client.flush(buildScopedPayload(args, config));
    case "evercore_delete":
      return client.delete(buildDeletePayload(args, config));
    case "evercore_scope":
      return resolveScope(args.cwd || process.cwd());
    case "evercore_remember":
      return remember(args, context);
    case "evercore_recall":
      return recall(args, context);
    case "evercore_briefing":
      return buildBriefing(normalizeHighLevelArgs(args), client);
    case "evercore_forget":
      return forget(args, context);
    case "evercore_ingest_codex":
      return ingestCodexSession({
        latest: args.latest ?? !args.file,
        file: args.file,
        dry_run: args.dry_run ?? true,
        force: args.force,
        group_id: args.group_id,
        user_id: args.user_id,
        session_id: args.session_id,
        flush: args.flush,
        cwd: args.cwd
      }, client);
    case "evercore_list_spaces":
      return listKnownSpaces(args, client);
    case "evercore_fetch_history":
      return fetchHistory(args, client, config);
    case "evercore_ingest_status":
      return getCodexIngestStatus({
        latest: args.latest ?? (!args.file && !args.source_hash),
        file: args.file,
        source_hash: args.source_hash,
        group_id: args.group_id,
        user_id: args.user_id,
        cwd: args.cwd
      }, client);
    case "evercore_request_status":
      return getRequestStatus(args, client, config);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export function withSchemaAliases(tool) {
  return {
    ...tool,
    input_schema: tool.inputSchema
  };
}

async function remember(args, { client, config }) {
  const scopeType = args.scope || "project";
  const resolved = resolveScope(args.cwd || process.cwd());
  const groupId = args.group_id || process.env.EVERCORE_DEFAULT_GROUP_ID || resolved.group_id;
  const userId = args.user_id || config.defaultUserId;
  const sessionId = args.session_id || config.defaultSessionId || `memory-${Date.now()}`;
  const senderId = args.sender_id || "codex";
  const senderName = args.sender_name || "Codex";
  const category = args.category || "note";
  const importance = args.importance ?? 0.5;
  const flush = args.flush ?? true;
  const content = `[category:${category}] [importance:${importance}] ${args.content}`;

  assertSafeToStore(content);

  if (scopeType === "project") {
    const writeResult = await client.rememberGroup({
      group_id: groupId,
      group_meta: { source: "mcp", category, importance, repo_scope: resolved.repo_scope },
      messages: [{
        role: "user",
        timestamp: Date.now(),
        sender_id: senderId,
        sender_name: senderName,
        content
      }]
    });
    const flushResult = flush ? await client.flushGroup({ group_id: groupId }) : null;
    return { ok: true, scope: scopeType, group_id: groupId, session_id: sessionId, category, write_result: writeResult, flush_result: flushResult };
  }

  if (!userId) {
    throw new Error("evercore_remember requires user_id or EVERCORE_DEFAULT_USER_ID for user/agent scope");
  }

  const messages = [{
    role: "user",
    timestamp: Date.now(),
    content,
    sender_id: senderId,
    sender_name: senderName
  }];

  if (scopeType === "agent") {
    const writeResult = await client.rememberAgent({ user_id: userId, session_id: sessionId, messages });
    const flushResult = flush ? await client.flushAgent({ user_id: userId, session_id: sessionId }) : null;
    return { ok: true, scope: scopeType, user_id: userId, session_id: sessionId, category, write_result: writeResult, flush_result: flushResult };
  }

  const writeResult = await client.add({ user_id: userId, session_id: sessionId, messages });
  const flushResult = flush ? await client.flush({ user_id: userId, session_id: sessionId }) : null;
  return { ok: true, scope: scopeType, user_id: userId, session_id: sessionId, category, write_result: writeResult, flush_result: flushResult };
}

async function recall(args, { client, config }) {
  const scopeType = args.scope || "project";
  const resolved = resolveScope(args.cwd || process.cwd());
  const groupId = args.group_id || process.env.EVERCORE_DEFAULT_GROUP_ID || resolved.group_id;
  const userId = args.user_id || config.defaultUserId;
  const filters = buildRecallFilters({ scopeType, groupId, userId });
  const query = buildCategoryQuery(args.query, args.categories);

  const payload = {
    query,
    method: args.method || "hybrid",
    memory_types: ["episodic_memory", "profile", "agent_memory"],
    filters,
    top_k: args.top_k ?? 5,
    include_original_data: false
  };
  const rawResult = await client.search(payload);
  const rawMessageResult = args.include_raw
    ? await client.search({
      query,
      method: "keyword",
      memory_types: ["raw_message"],
      filters,
      top_k: args.top_k ?? 5,
      include_original_data: false
    })
    : null;
  const snippets = [
    ...normalizeSearchSnippets(rawResult),
    ...normalizeSearchSnippets(rawMessageResult)
  ];

  return compactObject({
    query: args.query,
    effective_query: query === args.query ? undefined : query,
    filters,
    snippets,
    raw_result: args.include_raw_result ? { memory_result: rawResult, raw_message_result: rawMessageResult } : undefined
  });
}

function buildCategoryQuery(query, categories) {
  if (!Array.isArray(categories) || categories.length === 0) return query;
  return `${categories.map((category) => `category:${category}`).join(" ")} ${query}`;
}

async function forget(args, { client, config }) {
  const payload = buildForgetPayload(args, config);
  const isScopeDelete = !payload.memory_id;
  if (isScopeDelete && args.confirm !== "delete") {
    return { ok: false, would_delete: payload, required_confirm: "delete" };
  }
  return { ok: true, delete_payload: payload, delete_result: await client.delete(payload) };
}

function buildRecallFilters({ scopeType, groupId, userId }) {
  if (scopeType === "project") return { group_id: groupId };
  if (scopeType === "user") {
    if (!userId) throw new Error("evercore_recall user scope requires user_id or EVERCORE_DEFAULT_USER_ID");
    return { user_id: userId };
  }
  if (groupId) return { group_id: groupId };
  if (userId) return { user_id: userId };
  throw new Error("evercore_recall all scope requires user_id or group_id");
}

function buildForgetPayload(args, config) {
  if (args.memory_id) return { memory_id: args.memory_id };
  if (args.group_id) return { group_id: args.group_id };
  const userId = args.user_id || config.defaultUserId;
  if (userId && args.session_id) return { user_id: userId, session_id: args.session_id };
  if (userId && args.sender_id) return { user_id: userId, sender_id: args.sender_id };
  throw new Error("evercore_forget requires memory_id, group_id, user_id+session_id, or user_id+sender_id");
}

function normalizeHighLevelArgs(args) {
  return {
    ...args,
    groupId: args.group_id,
    userId: args.user_id,
    topK: args.top_k
  };
}

function lowLevelSearchProperties() {
  return {
    query: { type: "string", minLength: 1 },
    method: { type: "string", enum: ["keyword", "vector", "hybrid", "agentic"], default: "hybrid" },
    memory_types: {
      type: "array",
      items: { type: "string", enum: ["episodic_memory", "profile", "raw_message", "agent_memory"] },
      default: ["episodic_memory", "profile"]
    },
    filters: { type: "object", additionalProperties: true },
    top_k: { type: "integer", minimum: -1, maximum: 100, default: 5 },
    include_original_data: { type: "boolean", default: false }
  };
}

function deleteProperties() {
  return {
    memory_id: { type: "string" },
    user_id: { type: "string" },
    group_id: { type: "string" },
    session_id: { type: "string" },
    sender_id: { type: "string" }
  };
}

function messageArraySchema(roles) {
  return {
    type: "array",
    minItems: 1,
    maxItems: 500,
    items: {
      type: "object",
      required: ["role", "content"],
      properties: {
        role: { type: "string", enum: roles },
        timestamp: { type: "integer" },
        content: { type: "string" },
        message_id: { type: "string" },
        sender_id: { type: "string" },
        sender_name: { type: "string" }
      },
      additionalProperties: true
    }
  };
}
