import { getEverCoreConfig } from "./config.mjs";
import { EverCoreClient } from "./http.mjs";
import { resolveScope } from "./scope.mjs";
import { truncateText } from "./utils.mjs";

export const BRIEFING_SECTIONS = [
  ["Conventions", "project conventions coding workflow preferences"],
  ["Recent Decisions", "recent architecture decisions project decisions"],
  ["Known Pitfalls", "known pitfalls gotchas blockers debugging notes"],
  ["Recent Fixes", "recent bug fixes verification evidence"],
  ["Roadmap", "open roadmap next steps implementation plan"],
  ["Suggested Context For This Session", "important context for this coding session"]
];

export async function buildBriefing(options = {}, client = new EverCoreClient(getEverCoreConfig())) {
  const config = client.config || getEverCoreConfig();
  const scope = resolveScope(options.cwd || process.cwd());
  const groupId = options.group_id || options.groupId || options.space || options.group || process.env.EVERCORE_DEFAULT_GROUP_ID || scope.group_id;
  const userId = options.user_id || options.userId || options.user || config.defaultUserId;
  const preferUser = Boolean(options.user_only || options.userOnly);
  const topK = Number(options.top_k || options.topK || 5);
  const method = options.method || "hybrid";

  const results = [];
  for (const [title, query] of BRIEFING_SECTIONS) {
    const payload = {
      query,
      method,
      memory_types: ["episodic_memory", "profile", "agent_memory"],
      filters: buildBriefingFilters({ groupId, userId, preferUser }),
      top_k: topK,
      include_original_data: false
    };
    const result = await client.search(payload);
    results.push([title, extractSnippets(result)]);
  }

  return {
    scope,
    group_id: groupId,
    markdown: renderBriefing({ scope, groupId, results }),
    results
  };
}

export function renderBriefing({ scope, groupId, results }) {
  const lines = [
    "# Project Memory Briefing",
    "",
    `Scope: ${groupId}`,
    `Repo: ${scope.repo_root}`,
    ""
  ];

  for (const [title, snippets] of results) {
    lines.push(`## ${title}`, "");
    if (snippets.length === 0) {
      lines.push("- No matching memory found.", "");
      continue;
    }

    for (const snippet of snippets) {
      lines.push(`- ${snippet}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function extractSnippets(result) {
  const data = result?.data || result || {};
  const buckets = [
    data.episodes,
    data.profiles,
    data.agent_memories,
    data.agent_memory,
    data.raw_messages,
    data.memories,
    Array.isArray(data) ? data : []
  ].filter(Array.isArray);

  const snippets = [];
  for (const item of buckets.flat()) {
    const text = extractMemoryText(item);
    if (text) snippets.push(truncateText(text.replace(/\s+/g, " ").trim(), 260));
    if (snippets.length >= 5) break;
  }

  return snippets;
}

function extractMemoryText(item) {
  if (Array.isArray(item.content_items)) {
    return item.content_items.map((content) => content.text || content.content || "").filter(Boolean).join(" ");
  }
  return item.content || item.text || item.memory || item.summary || item.raw_content || item.message || "";
}

export function buildBriefingFilters({ groupId, userId, preferUser }) {
  if (preferUser && userId) return { user_id: userId };
  if (groupId) return { group_id: groupId };
  if (userId) return { user_id: userId };
  throw new Error("briefing requires a resolvable group_id or EVERCORE_DEFAULT_USER_ID");
}
