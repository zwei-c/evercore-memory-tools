import { compactObject } from "./utils.mjs";

export function buildSearchPayload(args, config) {
  if (!args.query || typeof args.query !== "string") {
    throw new Error("evercore_search requires a non-empty query");
  }

  const filters = args.filters && Object.keys(args.filters).length > 0
    ? { ...args.filters }
    : defaultUserFilter(config);

  if (config.defaultSessionId && !filters.session_id) {
    filters.session_id = config.defaultSessionId;
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

export function buildAddPayload(args, config) {
  const user_id = args.user_id || config.defaultUserId;
  const session_id = args.session_id || config.defaultSessionId;
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

export function buildScopedPayload(args, config) {
  const user_id = args.user_id || config.defaultUserId;
  const session_id = args.session_id || config.defaultSessionId;
  if (!user_id) {
    throw new Error("This operation requires user_id or EVERCORE_DEFAULT_USER_ID");
  }

  return compactObject({
    user_id,
    session_id: session_id || undefined
  });
}

export function buildDeletePayload(args, config) {
  if (args.memory_id) {
    return { memory_id: args.memory_id };
  }

  const user_id = args.user_id || config.defaultUserId;
  const session_id = args.session_id || config.defaultSessionId;
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

function defaultUserFilter(config) {
  if (!config.defaultUserId) {
    throw new Error("Search requires filters or EVERCORE_DEFAULT_USER_ID");
  }

  return { user_id: config.defaultUserId };
}

