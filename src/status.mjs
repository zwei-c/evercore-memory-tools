import { getCodexIngestStatus } from "./codex-ingest.mjs";
import { normalizeMemoryItem } from "./memory-text.mjs";

export async function getRequestStatus(options = {}, client, config = {}) {
  if (options.source_hash || options.sourceHash || options.latest || options.file) {
    const ingestStatus = await getCodexIngestStatus(options, client);
    return {
      status: mapIngestStatus(ingestStatus.status),
      confidence: ingestStatus.status === "not_found" ? "medium" : "high",
      evidence: ingestStatus.matches.map((match) => `${match.type}:${match.memory_id || match.request_id || "match"}`),
      limitations: ingestStatus.limitations || [],
      ingest_status: ingestStatus
    };
  }

  if (options.request_id || options.requestId) {
    const requestId = options.request_id || options.requestId;
    const filters = {};
    if (options.group_id || options.groupId) filters.group_id = options.group_id || options.groupId;
    if (options.user_id || options.userId || config.defaultUserId) filters.user_id = options.user_id || options.userId || config.defaultUserId;
    if (options.session_id || options.sessionId) filters.session_id = options.session_id || options.sessionId;

    if (!filters.group_id && !filters.user_id) {
      return {
        status: "unknown",
        confidence: "low",
        evidence: [],
        limitations: ["request_id lookup requires user_id or group_id because EverCore search filters require a scope."]
      };
    }

    const result = await client.search({
      query: requestId,
      method: "keyword",
      memory_types: ["raw_message"],
      filters,
      top_k: 10,
      include_original_data: false
    });
    const matches = (result?.data?.raw_messages || []).map((item) => normalizeMemoryItem(item, "raw_message"));
    return {
      status: matches.length > 0 ? "accepted" : "not_found",
      confidence: matches.length > 0 ? "medium" : "medium",
      evidence: matches.map((match) => `raw_message:${match.memory_id || match.request_id}`),
      limitations: ["No dedicated request status endpoint is available in this EverCore runtime."],
      matches
    };
  }

  return {
    status: "unknown",
    confidence: "low",
    evidence: [],
    limitations: ["No dedicated request status endpoint is available in this EverCore runtime. Provide request_id or source_hash for limited inference."]
  };
}

function mapIngestStatus(status) {
  if (status === "raw_found") return "accumulated";
  if (status === "extracted_found") return "extracted";
  if (status === "ambiguous") return "unknown";
  return "not_found";
}

