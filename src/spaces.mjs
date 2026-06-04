import { resolveScope } from "./scope.mjs";

export async function listKnownSpaces(options = {}, client) {
  const includeCurrent = options.include_current ?? options.includeCurrent ?? true;
  const includeConfig = options.include_config ?? options.includeConfig ?? true;
  const includeRemote = options.include_remote ?? options.includeRemote ?? true;
  const spaces = [];
  const limitations = [];

  if (includeCurrent) {
    const scope = resolveScope(options.cwd || process.cwd());
    spaces.push({
      space_id: scope.space_id,
      group_id: scope.group_id,
      source: "current_repo",
      repo_root: scope.repo_root,
      remote: scope.remote
    });
  }

  if (includeConfig) {
    const groupId = options.group_id || process.env.EVERCORE_DEFAULT_GROUP_ID;
    if (groupId) {
      spaces.push({
        space_id: groupId,
        group_id: groupId,
        source: "env"
      });
    }
    if (process.env.EVERCORE_DEFAULT_SESSION_ID) {
      spaces.push({
        space_id: `session:${process.env.EVERCORE_DEFAULT_SESSION_ID}`,
        group_id: process.env.EVERCORE_DEFAULT_GROUP_ID || null,
        session_id: process.env.EVERCORE_DEFAULT_SESSION_ID,
        source: "env"
      });
    }
  }

  if (includeRemote) {
    const remote = await probeRemoteGroups(client);
    spaces.push(...remote.spaces);
    limitations.push(...remote.limitations);
  }

  return { spaces: dedupeSpaces(spaces), limitations };
}

export async function probeRemoteGroups(client) {
  try {
    const result = await client.listGroups();
    const records = Array.isArray(result?.data) ? result.data : Array.isArray(result) ? result : [];
    return { spaces: records.map(normalizeGroupRecord), limitations: [] };
  } catch (error) {
    return {
      spaces: [],
      limitations: [`Remote group listing is unavailable: ${error.message}`]
    };
  }
}

export function normalizeGroupRecord(record) {
  return {
    space_id: record.group_id,
    group_id: record.group_id,
    source: "remote",
    name: record.name,
    description: record.description,
    created_at: record.created_at,
    updated_at: record.updated_at
  };
}

function dedupeSpaces(spaces) {
  const seen = new Set();
  const deduped = [];
  for (const space of spaces) {
    const key = `${space.source}:${space.group_id || ""}:${space.session_id || ""}:${space.space_id || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(space);
  }
  return deduped;
}

