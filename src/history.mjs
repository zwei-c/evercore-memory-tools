import { normalizeMemoryItem } from "./memory-text.mjs";
import { resolveScope } from "./scope.mjs";

const GET_MEMORY_TYPES = new Set(["episodic_memory", "profile", "agent_case", "agent_skill"]);

export async function fetchHistory(options = {}, client, config = {}) {
  const memoryTypes = options.memory_types || options.memoryTypes || ["raw_message", "episodic_memory", "agent_case", "agent_skill"];
  const page = Number(options.page || 1);
  const pageSize = Number(options.page_size || options.pageSize || 20);
  const results = [];
  const rawResults = [];
  const limitations = [];

  for (const memoryType of memoryTypes) {
    if (memoryType === "raw_message") {
      const raw = await fetchRawHistory(options, client, config);
      results.push(...raw.items);
      rawResults.push(raw.raw_result);
      limitations.push(...raw.limitations);
      continue;
    }

    if (!GET_MEMORY_TYPES.has(memoryType)) {
      limitations.push(`Unsupported history memory_type skipped: ${memoryType}`);
      continue;
    }

    const payload = buildHistoryPayload({ ...options, memory_type: memoryType }, config);
    const result = await client.getMemories(payload);
    rawResults.push(result);
    results.push(...normalizeHistoryItems(result, memoryType));
  }

  return {
    items: sortHistoryItems(results, options.rank_order || options.rankOrder || "desc").slice(0, pageSize),
    page,
    page_size: pageSize,
    has_more: results.length > pageSize,
    source_endpoint: "/api/v1/memories/get + /api/v1/memories/search",
    limitations,
    raw_result: options.include_raw_result || options.includeRawResult ? rawResults : undefined
  };
}

export function buildHistoryPayload(options = {}, config = {}) {
  const filters = buildHistoryFilters(options, config);
  return {
    memory_type: options.memory_type || options.memoryType || "episodic_memory",
    filters,
    page: Number(options.page || 1),
    page_size: Number(options.page_size || options.pageSize || 20),
    rank_by: options.rank_by || options.rankBy || "timestamp",
    rank_order: options.rank_order || options.rankOrder || "desc"
  };
}

export function normalizeHistoryItems(result, memoryType = "memory") {
  const data = result?.data || result || {};
  const buckets = [
    ["episodic_memory", data.episodes],
    ["profile", data.profiles],
    ["agent_case", data.agent_cases],
    ["agent_skill", data.agent_skills],
    ["raw_message", data.raw_messages],
    [memoryType, Array.isArray(data) ? data : []]
  ].filter(([, values]) => Array.isArray(values));

  return buckets.flatMap(([type, values]) => values.map((item) => normalizeMemoryItem(item, type)));
}

export function buildHistoryFilters(options = {}, config = {}) {
  const scopeType = options.scope || "project";
  const resolved = resolveScope(options.cwd || process.cwd());
  const groupId = options.group_id || options.groupId || process.env.EVERCORE_DEFAULT_GROUP_ID || resolved.group_id;
  const userId = options.user_id || options.userId || config.defaultUserId;
  const filters = {};

  if (scopeType === "project") {
    filters.group_id = groupId;
  } else if (scopeType === "user") {
    if (!userId) throw new Error("history user scope requires user_id or EVERCORE_DEFAULT_USER_ID");
    filters.user_id = userId;
  } else if (groupId) {
    filters.group_id = groupId;
  } else if (userId) {
    filters.user_id = userId;
  } else {
    throw new Error("history requires user_id or group_id");
  }

  const sessionId = options.session_id || options.sessionId;
  if (sessionId) filters.session_id = sessionId;
  return filters;
}

async function fetchRawHistory(options, client, config) {
  const filters = buildHistoryFilters(options, config);
  const query = options.query || options.source_hash || options.sourceHash || "*";
  const result = await client.search({
    query,
    method: "keyword",
    memory_types: ["raw_message"],
    filters,
    top_k: Number(options.page_size || options.pageSize || 20),
    include_original_data: false
  });
  return {
    items: normalizeHistoryItems(result, "raw_message"),
    raw_result: result,
    limitations: ["raw_message history uses /api/v1/memories/search because /api/v1/memories/get only supports extracted memory types."]
  };
}

function sortHistoryItems(items, order) {
  const direction = order === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    const left = Date.parse(a.timestamp || a.created_at || a.updated_at || 0) || 0;
    const right = Date.parse(b.timestamp || b.created_at || b.updated_at || 0) || 0;
    return (left - right) * direction;
  });
}

