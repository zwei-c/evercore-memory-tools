---
name: evercore-memory
description: Use this skill whenever a task can benefit from durable long-term memory through the self-hosted EverCore service. Trigger when the user mentions EverCore, EverOS memory, persistent memory, remembering preferences, recalling prior context, saving conversation knowledge, or when an agent should search/write/flush long-term memory across sessions.
---

# EverCore Memory

Use EverCore as a long-term memory backend. The MCP tools provide the mechanics; this skill defines when and how to use them safely.

## Available MCP Tools

Prefer MCP tools when available:

- `evercore_health` - check service health
- `evercore_search` - retrieve relevant memories
- `evercore_add` - store personal conversation messages
- `evercore_flush` - trigger memory extraction
- `evercore_delete` - soft delete memory by id or scope

If MCP tools are unavailable, use the direct HTTP payloads in `references/payload-examples.md`.

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
  "method": "hybrid",
  "memory_types": ["episodic_memory", "profile"],
  "top_k": 5
}
```

Use `raw_message` only when debugging ingestion or looking for very recent unflushed messages.

### While Answering

Treat retrieved memory as context, not as proof. If the memory may be stale, say so and verify from live files or services when correctness matters.

When multiple memories conflict, prefer the newest verified source. Ask or verify instead of guessing when the conflict affects code, security, deployment, or money.

### After Useful Interactions

Write memory only when the information is durable and likely useful later:

- User preferences and standing instructions
- Stable project decisions
- Verified service endpoints and operational facts
- Debug findings that explain a root cause
- Reusable workflows and commands

Do not store low-value transcript filler, transient command output, or speculative analysis.

### Flush Boundaries

Call `evercore_flush` after meaningful boundaries:

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

- Store: "The EverCore instance is available at https://evercore.example.com and is restricted by internal IP allowlist."
- Do not store: raw reverse proxy credentials, auth headers, or allowlist internals.

## User And Session Naming

Use stable, explicit scopes.

Recommended:

- `user_id`: the human owner, such as `wei`
- `session_id`: a compact task/session slug, such as `evercore-mcp-setup-20260601`

For tests, use disposable scopes such as `codex-smoke-user` and delete them after verification.

## Direct Reference

Read `references/payload-examples.md` when you need exact curl requests, MCP tool call shapes, or troubleshooting examples.

