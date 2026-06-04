import { compactObject, truncateText } from "./utils.mjs";

export function extractMemoryText(item) {
  if (!item || typeof item !== "object") return "";
  if (Array.isArray(item.content_items)) {
    return item.content_items.map((content) => content.text || content.content || "").filter(Boolean).join(" ");
  }
  if (item.profile_data) {
    return JSON.stringify(item.profile_data);
  }
  return item.content || item.text || item.memory || item.summary || item.episode || item.raw_content || item.message || item.task_intent || item.approach || item.description || "";
}

export function normalizeMemoryItem(item, type = "memory") {
  const text = extractMemoryText(item);

  return compactObject({
    type,
    memory_id: item?.memory_id || item?.id,
    text: text ? truncateText(text.replace(/\s+/g, " ").trim(), 500) : undefined,
    score: item?.score,
    user_id: item?.user_id,
    group_id: item?.group_id,
    session_id: item?.session_id,
    sender_id: item?.sender_id,
    request_id: item?.request_id,
    created_at: item?.created_at,
    updated_at: item?.updated_at,
    timestamp: item?.timestamp
  });
}

export function normalizeSearchSnippets(result) {
  const data = result?.data || result || {};
  const buckets = [
    ["episodic_memory", data.episodes],
    ["profile", data.profiles],
    ["agent_memory", data.agent_memories || data.agent_memory?.cases],
    ["agent_skill", data.agent_memory?.skills],
    ["raw_message", data.raw_messages],
    ["memory", data.memories],
    ["memory", Array.isArray(data) ? data : []]
  ].filter(([, values]) => Array.isArray(values));

  const snippets = [];
  for (const [type, values] of buckets) {
    for (const item of values) {
      const normalized = normalizeMemoryItem(item, type);
      if (!normalized.text) continue;
      snippets.push(normalized);
    }
  }
  return snippets;
}
