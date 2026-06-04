# EverCore Memory Tools

[繁體中文](README.zh-TW.md)

Unofficial MCP adapter and agent skill workflow for self-hosted EverCore-compatible memory services.

This project targets local or self-hosted EverCore API deployments, not EverMemOS Cloud-first workflows. It gives coding agents durable project memory across sessions: decisions, conventions, bug fixes, roadmap context, and repo-scoped briefing restore.

The MCP server intentionally has no npm dependencies. It speaks MCP stdio JSON-RPC directly and forwards calls to EverCore HTTP endpoints.

## Layout

- `bin/evercore-memory-mcp.mjs` - stdio MCP server
- `src/` - shared scope, payload, HTTP, and safety helpers
- `scripts/scope.mjs` - repo-to-memory scope resolver
- `scripts/briefing.mjs` - project memory briefing CLI
- `scripts/history.mjs` - limited memory history CLI
- `scripts/ingest-codex-session.mjs` - Codex rollout transcript ingestion CLI
- `scripts/ingest-status.mjs` - Codex source hash ingestion status CLI
- `scripts/spaces.mjs` - local/config/remote memory space discovery CLI
- `scripts/high-level-tools-smoke.mjs` - MCP high-level workflow smoke test
- `scripts/test.mjs` - dependency-free unit tests
- `skill/SKILL.md` - agent workflow skill
- `skill/references/payload-examples.md` - EverCore request examples
- `scripts/smoke-test.mjs` - end-to-end EverCore API smoke test
- `scripts/list-tools.mjs` - local MCP protocol smoke test

## Requirements

- Node.js 20+
- A running EverCore-compatible API service

By default, the tools assume the EverOS local quickstart endpoint:

```bash
export EVERCORE_BASE_URL="http://localhost:1995"
```

Optional:

```bash
export EVERCORE_API_KEY="..."
export EVERCORE_DEFAULT_USER_ID="developer"
export EVERCORE_DEFAULT_SESSION_ID="project-slug"
```

`EVERCORE_API_KEY` is only needed if your reverse proxy or service requires bearer auth.

## Run Smoke Tests

```bash
npm run tools
EVERCORE_BASE_URL="http://localhost:1995" npm run smoke
EVERCORE_BASE_URL="http://localhost:1995" npm run high-level-tools
```

`npm run tools` verifies MCP handshake/tool schemas. `npm run smoke` writes, searches, flushes, and deletes disposable test data from the configured EverCore service. `npm run high-level-tools` validates the MCP-first workflow with disposable project memory.

## Coding Memory Workflow

Resolve the current repo scope:

```bash
npm run scope
```

Example output:

```json
{
  "cwd": "/workspace/evercore-memory-tools",
  "repo_root": "/workspace/evercore-memory-tools",
  "remote": "git@github.com:example-org/evercore-memory-tools.git",
  "repo_scope": "github:example-org/evercore-memory-tools",
  "space_id": "coding:github:example-org/evercore-memory-tools",
  "group_id": "coding:github:example-org/evercore-memory-tools"
}
```

Generate a session-start Markdown briefing from project memory:

```bash
EVERCORE_BASE_URL="http://localhost:1995" npm run briefing
```

Ingest the latest Codex rollout transcript:

```bash
EVERCORE_BASE_URL="http://localhost:1995" npm run ingest:codex -- --latest
```

Use `--dry-run` to inspect the resolved scope and redacted payloads without writing:

```bash
npm run ingest:codex -- --latest --dry-run
```

The ingestion command summarizes user requests, final responses, and important tool outcomes. It redacts common secret patterns before writing. Project summaries target `/api/v1/memories/group` first and fall back to personal `/api/v1/memories` if the self-hosted API does not expose group writes. Agent trajectory writes target `/api/v1/memories/agent` and are skipped with a diagnostic reason if unavailable.

Inspect spaces, history, and Codex ingestion status:

```bash
npm run spaces
npm run history -- --scope project --memory-types raw_message,episodic_memory --query "recent decisions"
npm run ingest:status -- --latest
```

## High-Level MCP Workflow

Prefer high-level tools for daily agent workflow:

- `evercore_scope` - resolves the current repo memory scope
- `evercore_briefing` - renders a Markdown context briefing
- `evercore_remember` - stores durable project, user, or agent memory with safety checks
- `evercore_recall` - returns normalized memory snippets
- `evercore_forget` - deletes an explicit memory or confirmed disposable scope
- `evercore_ingest_codex` - builds or writes a Codex rollout summary; defaults to dry-run
- `evercore_list_spaces` - lists current/configured spaces and remote groups when supported
- `evercore_fetch_history` - fetches a limited memory timeline through `/get` and raw-message search fallback
- `evercore_ingest_status` - checks whether a Codex transcript `source_hash` is already present
- `evercore_request_status` - infers limited request/source status from search evidence

Low-level tools remain available for debugging exact EverCore API calls:

- `evercore_health`
- `evercore_search`
- `evercore_add`
- `evercore_flush`
- `evercore_delete`

## MCP Client Config

### Option A: Run from GitHub

```json
{
  "mcpServers": {
    "evercore-memory": {
      "command": "npx",
      "args": [
        "-y",
        "git+ssh://git@github.com/example-org/evercore-memory-tools.git"
      ],
      "env": {
        "EVERCORE_BASE_URL": "http://localhost:1995",
        "EVERCORE_DEFAULT_USER_ID": "developer"
      }
    }
  }
}
```

### Option B: Local Development

```json
{
  "mcpServers": {
    "evercore-memory": {
      "command": "node",
      "args": ["/path/to/evercore-memory-tools/bin/evercore-memory-mcp.mjs"],
      "env": {
        "EVERCORE_BASE_URL": "http://localhost:1995",
        "EVERCORE_DEFAULT_USER_ID": "developer"
      }
    }
  }
}
```

## Project Isolation

Set `EVERCORE_DEFAULT_SESSION_ID` per repo or workspace to keep memories scoped:

```json
{
  "mcpServers": {
    "evercore-memory": {
      "env": {
        "EVERCORE_DEFAULT_SESSION_ID": "my-project"
      }
    }
  }
}
```

This lets one human user maintain separate memory spaces for different codebases without relying on the model to infer scope.

## Tools

- `evercore_scope` - resolves the repo-scoped `group_id`
- `evercore_remember` - stores durable high-level memory
- `evercore_recall` - searches and normalizes memory snippets
- `evercore_briefing` - generates a session-start Markdown briefing
- `evercore_forget` - guarded delete wrapper
- `evercore_ingest_codex` - Codex transcript ingestion wrapper
- `evercore_list_spaces` - lists known memory spaces
- `evercore_fetch_history` - fetches scoped memory history
- `evercore_ingest_status` - checks Codex source-hash ingestion state
- `evercore_request_status` - infers limited request/source status
- `evercore_health` - checks `/health`
- `evercore_search` - searches memory through `/api/v1/memories/search`
- `evercore_add` - stores personal messages through `/api/v1/memories`
- `evercore_flush` - triggers extraction through `/api/v1/memories/flush`
- `evercore_delete` - soft deletes memories through `/api/v1/memories/delete`

## CLI Commands

- `npm run scope` - prints the resolved repo memory scope
- `npm run briefing` - renders a Markdown project memory briefing
- `npm run spaces` - lists current/configured spaces and remote groups when available
- `npm run history` - fetches scoped memory history
- `npm run ingest:codex -- --latest` - ingests the latest Codex rollout session
- `npm run ingest:status -- --latest` - checks whether a Codex rollout appears ingested
- `npm run high-level-tools` - validates high-level MCP tools through JSON-RPC
- `npm run test` - runs dependency-free unit tests
- `npm run tools` - validates MCP handshake and schemas
- `npm run smoke` - runs an end-to-end EverCore API smoke test with disposable data
- `npm run smoke:remote` - runs smoke against the `EVERCORE_BASE_URL` you provide

## Status

This is an unofficial adapter. It is intended for self-hosted EverCore-compatible API deployments and local coding-agent workflows.

Known limitation: the current tested self-hosted runtime exposes `/api/v1/groups` in OpenAPI but may return `405 Method Not Allowed` for group listing. `evercore_list_spaces` therefore always returns local/config-derived spaces and reports remote listing as a limitation when unsupported.
