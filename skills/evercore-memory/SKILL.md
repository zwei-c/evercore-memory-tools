---
name: evercore-memory
description: Use this skill whenever a task can benefit from durable long-term memory through the self-hosted EverCore service. Trigger when the user mentions EverCore, EverOS memory, persistent memory, remembering preferences, recalling prior context, saving conversation knowledge, or when an agent should search/write/flush long-term memory across sessions.
license: MIT
metadata:
  author: zwei-c
  version: "0.1.0"
  homepage: https://github.com/zwei-c/evercore-memory-tools
  source: https://github.com/zwei-c/evercore-memory-tools
---

# EverCore Memory

Use EverCore as a long-term memory backend. The MCP tools provide the mechanics; this skill defines when and how to use them safely.

## Available MCP Tools

Prefer MCP tools when available:

- `evercore_scope` - resolve the current repo memory scope
- `evercore_briefing` - render a session-start memory briefing
- `evercore_remember` - store durable project/user/agent memory with safety checks
- `evercore_recall` - retrieve normalized memory snippets
- `evercore_forget` - safely delete an explicit memory or confirmed scope
- `evercore_ingest_codex` - build or write a Codex rollout transcript summary; dry-run by default
- `evercore_list_spaces` - list current/configured memory spaces and remote groups when supported
- `evercore_fetch_history` - fetch limited scoped memory history
- `evercore_ingest_status` - check Codex rollout ingestion by `source_hash` or latest/file transcript
- `evercore_request_status` - infer limited request/source status from search evidence
- `evercore_health` - check service health
- `evercore_search` - retrieve relevant memories
- `evercore_add` - store personal conversation messages
- `evercore_flush` - trigger memory extraction
- `evercore_delete` - soft delete memory by id or scope

Use high-level tools for normal workflow. Use low-level tools only when debugging exact EverCore API behavior or compatibility.

If MCP tools are unavailable, use the direct HTTP payloads in `references/payload-examples.md`.

## Local CLI Workflow

When this skill is installed from the tool repo, the package also provides local workflow commands:

- `npm run scope` - resolve the current repo into a stable `coding:<provider>:<owner>/<repo>` group id
- `npm run briefing` - render a Markdown briefing for the current repo scope
- `npm run spaces` - list current/configured spaces and remote groups when supported
- `npm run history` - fetch a limited scoped memory timeline
- `npm run ingest:codex -- --latest` - ingest the latest Codex rollout transcript
- `npm run ingest:codex -- --latest --dry-run` - inspect redacted payloads before writing
- `npm run ingest:status -- --latest` - check whether the latest Codex rollout appears ingested
- `npm run high-level-tools` - validate high-level MCP tools with disposable project memory
- `npm run test` - run dependency-free parser/schema/safety tests

Set `EVERCORE_BASE_URL` to the target self-hosted EverCore endpoint before running networked commands.

## Memory Workflow

### Before Answering

Search memory when prior context could change the answer:

- The user asks what they previously decided, preferred, configured, tested, or deployed.
- The task spans sessions, repositories, projects, users, apps, or prior decisions.
- The user asks the assistant to remember or continue something.
- You are about to make assumptions about preferences or project conventions.

Do not search memory for trivial one-off tasks where past context is irrelevant.

Recommended search defaults:

```json
{
	"name": "evercore_recall",
	"arguments": {
		"query": "What did we decide about this project?",
		"scope": "project",
		"top_k": 5
	}
}
```

Use `include_raw` only when debugging ingestion or looking for very recent unflushed messages.

### While Answering

Treat retrieved memory as context, not as proof. If the memory may be stale, say so and verify from live files or services when correctness matters.

When multiple memories conflict, prefer the newest verified source. Ask or verify instead of guessing when the conflict affects code, security, deployment, or money.

### After Useful Interactions

Write memory with `evercore_remember` only when the information is durable and likely useful later:

- User preferences and standing instructions
- Stable project decisions
- Verified service endpoints and operational facts
- Debug findings that explain a root cause
- Reusable workflows and commands

Do not store low-value transcript filler, transient command output, or speculative analysis.

### Flush Boundaries

For normal memory writes, let `evercore_remember` flush when `flush` is true. Call `evercore_flush` or the low-level flush tools only when debugging or handling a manual boundary:

- A task is completed
- The user explicitly says to remember something
- A topic changes after several messages
- A deployment/configuration/test result has been verified

Avoid flushing after every short message; batching gives the extractor better context.

## Privacy And Safety

Do not store secrets:

- `.env` values
- API keys, tokens, passwords, cookies, private keys
- Full personal identifiers or private financial data unless the user explicitly asks and the memory is necessary
- Raw proprietary code snippets unless they are essential to a stable project memory

When a useful memory includes sensitive adjacent details, summarize only the safe durable fact.

Example:

- Store: "The self-hosted EverCore instance is available through the configured internal endpoint."
- Do not store: raw reverse proxy credentials, auth headers, or allowlist internals.

## User And Session Naming

Use stable, explicit scopes.

Recommended:

- `user_id`: the human owner, such as `developer`
- `session_id`: a compact task/session slug, such as `evercore-mcp-setup-20260601`

For tests, use disposable scopes such as `codex-smoke-user` and delete them after verification.

## Direct Reference

Read `references/payload-examples.md` when you need exact curl requests, MCP tool call shapes, or troubleshooting examples.
