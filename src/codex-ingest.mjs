import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getEverCoreConfig } from "./config.mjs";
import { EverCoreClient } from "./http.mjs";
import { resolveScope } from "./scope.mjs";
import { assertSafeToStore, redactSensitiveText } from "./safety.mjs";
import { compactObject, truncateText } from "./utils.mjs";
import { normalizeSearchSnippets } from "./memory-text.mjs";

export function latestCodexSessionPath(root = path.join(os.homedir(), ".codex", "sessions")) {
  let latest = null;
  for (const filePath of walk(root)) {
    if (!/rollout-.*\.jsonl$/.test(path.basename(filePath))) continue;
    const stat = fs.statSync(filePath);
    if (!latest || stat.mtimeMs > latest.mtimeMs) {
      latest = { filePath, mtimeMs: stat.mtimeMs };
    }
  }
  return latest?.filePath || "";
}

export function parseCodexSession(filePath) {
  const lines = fs.readFileSync(filePath, "utf8").split(/\n+/).filter(Boolean);
  const meta = {};
  const userRequests = [];
  const assistantFinals = [];
  const toolOutcomes = [];
  const trajectory = [];

  for (const line of lines) {
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      continue;
    }

    if (record.type === "session_meta") {
      Object.assign(meta, record.payload || {});
      if (meta.timestamp) meta.timestampMs = Date.parse(meta.timestamp);
      continue;
    }

    if (record.type !== "response_item") continue;
    const payload = record.payload || {};
    const timestampMs = record.timestamp ? Date.parse(record.timestamp) : undefined;

    if (payload.type === "message") {
      const text = contentText(payload.content);
      if (!text) continue;
      const clean = truncateText(redactSensitiveText(text), 3000);
      if (isBootstrapContext(clean)) continue;
      if (payload.role === "user") {
        userRequests.push(clean);
        trajectory.push({ role: "user", timestampMs, content: clean });
      } else if (payload.role === "assistant") {
        trajectory.push({ role: "assistant", timestampMs, content: clean });
        if (payload.phase === "final") assistantFinals.push(clean);
      }
      continue;
    }

    if (payload.type === "function_call_output") {
      const output = redactSensitiveText(payload.output || "");
      const summary = summarizeToolOutput(output);
      if (summary) toolOutcomes.push(summary);
    }
  }

  return { meta, userRequests, assistantFinals, toolOutcomes, trajectory };
}

export function buildSessionSummary({ file, parsed, scope, groupId, sourceHash }) {
  const lines = [
    "# Codex Session Summary",
    "",
    `Session: ${parsed.meta.id || path.basename(file)}`,
    `Source: ${file}`,
    `Source Hash: ${sourceHash}`,
    `CWD: ${parsed.meta.cwd || "unknown"}`,
    `Scope: ${groupId}`,
    `Repo: ${scope.repo_root}`,
    ""
  ];

  appendList(lines, "User Requests", parsed.userRequests, 5);
  appendList(lines, "Assistant Final Responses", parsed.assistantFinals, 5);
  appendList(lines, "Tool Outcomes", parsed.toolOutcomes, 8);

  if (parsed.assistantFinals.length === 0 && parsed.userRequests.length === 0) {
    lines.push("No high-value transcript messages were detected.");
  }

  return redactSensitiveText(lines.join("\n"));
}

export function buildCodexIngestPayloads(options = {}) {
  const file = options.latest ? latestCodexSessionPath(options.sessionsRoot) : options.file;
  if (!file) {
    throw new Error("Codex ingest requires latest=true or file");
  }

  const parsed = parseCodexSession(file);
  const cwd = options.cwd || parsed.meta.cwd || process.cwd();
  const scope = resolveScope(cwd);
  const config = getEverCoreConfig();
  const groupId = options.group_id || options.groupId || options.space || options.group || process.env.EVERCORE_DEFAULT_GROUP_ID || scope.group_id;
  const userId = options.user_id || options.userId || options.user || config.defaultUserId || "developer";
  const sessionId = options.session_id || options.sessionId || options.session || parsed.meta.id || `codex-${Date.now()}`;
  const sourceHash = hashContent(JSON.stringify({
    file,
    sessionId,
    userRequests: parsed.userRequests,
    assistantFinals: parsed.assistantFinals,
    toolOutcomes: parsed.toolOutcomes
  }));
  const summary = buildSessionSummary({ file, parsed, scope, groupId, sourceHash });
  assertSafeToStore(summary);

  for (const item of parsed.trajectory) {
    assertSafeToStore(item.content);
  }

  const groupPayload = {
    group_id: groupId,
    group_meta: {
      source: "codex",
      repo_scope: scope.repo_scope,
      session_id: sessionId,
      source_hash: sourceHash
    },
    messages: [
      {
        role: "user",
        timestamp: parsed.meta.timestampMs || Date.now(),
        sender_id: "codex",
        sender_name: "Codex",
        content: summary
      }
    ]
  };

  const agentPayload = compactObject({
    user_id: userId,
    session_id: sessionId,
    messages: parsed.trajectory.map((item, index) => ({
      role: item.role,
      timestamp: item.timestampMs || Date.now() + index,
      content: item.content
    }))
  });

  return { file, scope, parsed, group_id: groupId, user_id: userId, session_id: sessionId, source_hash: sourceHash, groupPayload, agentPayload };
}

export async function ingestCodexSession(options = {}, client = new EverCoreClient(getEverCoreConfig())) {
  const payloads = buildCodexIngestPayloads(options);
  const dryRun = options.dry_run ?? options.dryRun ?? true;
  const flush = options.flush ?? !options.noFlush;

  if (dryRun) {
    return {
      ok: true,
      dry_run: true,
      file: payloads.file,
      scope: payloads.scope,
      group_id: payloads.group_id,
      user_id: payloads.user_id,
      session_id: payloads.session_id,
      source_hash: payloads.source_hash,
      groupPayload: payloads.groupPayload,
      agentPayload: payloads.agentPayload
    };
  }

  const ingestStatus = await getCodexIngestStatus({
    source_hash: payloads.source_hash,
    group_id: payloads.group_id,
    user_id: payloads.user_id
  }, client);

  if (!options.force && ingestStatus.status !== "not_found") {
    return {
      ok: true,
      skipped: true,
      reason: "source_hash already exists",
      group_id: payloads.group_id,
      session_id: payloads.session_id,
      source_hash: payloads.source_hash,
      ingest_status: ingestStatus
    };
  }

  const groupResult = await client.rememberGroup(payloads.groupPayload);
  let agentResult = null;
  if (payloads.agentPayload.messages.length > 0) {
    agentResult = await client.rememberAgent(payloads.agentPayload);
  }

  let groupFlushResult = null;
  let agentFlushResult = null;
  if (flush) {
    groupFlushResult = await client.flushGroup({ group_id: payloads.group_id });
    if (payloads.agentPayload.messages.length > 0) {
      agentFlushResult = await client.flushAgent({ user_id: payloads.user_id, session_id: payloads.session_id });
    }
  }

  return {
    ok: true,
    dry_run: false,
    file: payloads.file,
    group_id: payloads.group_id,
    user_id: payloads.user_id,
    session_id: payloads.session_id,
    source_hash: payloads.source_hash,
    previous_matches: options.force ? ingestStatus.matches : undefined,
    group_result: groupResult,
    agent_result: agentResult,
    group_flush_result: groupFlushResult,
    agent_flush_result: agentFlushResult
  };
}

export async function hasExistingSourceHash(client, groupId, sourceHash) {
  const status = await getCodexIngestStatus({ source_hash: sourceHash, group_id: groupId }, client);
  return status.status !== "not_found";
}

export async function getCodexIngestStatus(options = {}, client = new EverCoreClient(getEverCoreConfig())) {
  const payloads = options.source_hash || options.sourceHash
    ? null
    : buildCodexIngestPayloads({ ...options, latest: options.latest ?? !options.file });
  const sourceHash = options.source_hash || options.sourceHash || payloads.source_hash;
  const groupId = options.group_id || options.groupId || payloads?.group_id;
  const userId = options.user_id || options.userId || payloads?.user_id;
  const filters = groupId ? { group_id: groupId } : { user_id: userId };

  if (!filters.group_id && !filters.user_id) {
    throw new Error("ingest status requires group_id, user_id, source_hash with scope, or a resolvable Codex file");
  }

  const result = await client.search({
    query: sourceHash,
    method: "keyword",
    memory_types: ["raw_message"],
    filters,
    top_k: 10,
    include_original_data: false
  });
  const extracted = await client.search({
    query: sourceHash,
    method: "keyword",
    memory_types: ["episodic_memory", "agent_memory"],
    filters,
    top_k: 10,
    include_original_data: false
  });
  const rawMatches = normalizeSearchSnippets(result);
  const extractedMatches = normalizeSearchSnippets(extracted);
  const matches = [...rawMatches, ...extractedMatches];
  const status = statusFromMatches(rawMatches, extractedMatches, sourceHash);

  return {
    source_hash: sourceHash,
    group_id: groupId,
    user_id: userId,
    status,
    matches,
    limitations: []
  };
}

export function summarizeToolOutput(output) {
  const text = output.replace(/\s+/g, " ").trim();
  if (!text) return "";
  const tokenCount = text.match(/Original token count:\s*(\d+)/);
  if (tokenCount && Number(tokenCount[1]) > 5000) {
    const exit = text.match(/Process exited with code \d+/)?.[0] || "Process exited";
    return `${exit}; output omitted because it exceeded ${tokenCount[1]} tokens.`;
  }
  if (/Process exited with code 0/.test(text)) {
    return truncateText(text, 500);
  }
  if (/failed|error|Exception|Traceback|Process exited with code [1-9]/i.test(text)) {
    return truncateText(text, 800);
  }
  return "";
}

export function isBootstrapContext(text) {
  return text.startsWith("# AGENTS.md instructions") || text.includes("<environment_context>");
}

function contentText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((item) => item.text || item.output_text || "").filter(Boolean).join("\n");
}

function appendList(lines, title, values, limit) {
  lines.push(`## ${title}`, "");
  const selected = values.filter(Boolean).slice(-limit);
  if (selected.length === 0) {
    lines.push("- None captured.", "");
    return;
  }
  for (const value of selected) {
    lines.push(`- ${truncateText(value.replace(/\s+/g, " ").trim(), 1000)}`);
  }
  lines.push("");
}

function hashContent(content) {
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 24);
}

function statusFromMatches(rawMatches, extractedMatches) {
  if (rawMatches.length > 0 && extractedMatches.length > 0) return "ambiguous";
  if (rawMatches.length > 0) return "raw_found";
  if (extractedMatches.length > 0) return "extracted_found";
  return "not_found";
}

function* walk(root) {
  if (!fs.existsSync(root)) return;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      yield* walk(entryPath);
    } else if (entry.isFile()) {
      yield entryPath;
    }
  }
}
