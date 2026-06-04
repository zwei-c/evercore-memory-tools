# EverCore Memory Tools

[繁體中文](README.zh-TW.md)

MCP server for using a self-hosted EverCore-compatible memory service with coding agents.

It gives agents durable project memory across sessions: decisions, conventions, bug fixes, roadmap context, repo-scoped recall, and Codex session summaries.

## Requirements

- Node.js 20+
- A running EverCore-compatible API service

```bash
export EVERCORE_BASE_URL="http://localhost:1995"
export EVERCORE_DEFAULT_USER_ID="developer"
```

Set `EVERCORE_API_KEY` only when your EverCore endpoint requires bearer authentication.

## MCP Setup

Use the package through `npx`:

```json
{
  "mcpServers": {
    "evercore-memory": {
      "command": "npx",
      "args": ["-y", "evercore-memory-tools"],
      "env": {
        "EVERCORE_BASE_URL": "http://localhost:1995",
        "EVERCORE_DEFAULT_USER_ID": "developer"
      }
    }
  }
}
```

For a local checkout:

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

## Tools

Daily workflow tools:

- `evercore_scope` - resolve the current repository memory scope
- `evercore_briefing` - render a Markdown context briefing
- `evercore_remember` - store durable project, user, or agent memory with safety checks
- `evercore_recall` - retrieve normalized memory snippets
- `evercore_forget` - delete an explicit memory or confirmed test scope
- `evercore_ingest_codex` - build or write a Codex rollout summary; dry-run by default
- `evercore_list_spaces` - list current/configured memory spaces
- `evercore_fetch_history` - fetch limited scoped memory history
- `evercore_ingest_status` - check whether a Codex transcript source hash is present
- `evercore_request_status` - infer limited request/source status from search evidence

Low-level compatibility tools:

- `evercore_health`
- `evercore_search`
- `evercore_add`
- `evercore_flush`
- `evercore_delete`

## CLI

The same workflow is available from npm scripts when running from a checkout:

```bash
npm run scope
npm run briefing
npm run spaces
npm run history -- --scope project --memory-types raw_message,episodic_memory --query "recent decisions"
npm run ingest:codex -- --latest --dry-run
npm run ingest:status -- --latest
```

`ingest:codex` reads Codex rollout transcripts from `~/.codex/sessions/**/rollout-*.jsonl`, summarizes useful session context, redacts common secret patterns, and can write project/agent memory to EverCore.

## Project Isolation

Project memory is scoped through EverCore `group_id`. By default, the tool derives a stable group from the current Git remote, for example:

```text
coding:github:example-org/example-repo
```

You can override or supplement scope with environment variables:

```bash
export EVERCORE_DEFAULT_GROUP_ID="coding:my-project"
export EVERCORE_DEFAULT_SESSION_ID="my-project"
```

## Safety

The high-level write paths include a conservative sensitive-content guard for common secrets such as API keys, bearer tokens, passwords, cookies, private keys, and `.env` dumps.

Treat memory as durable operational context. Store decisions, conventions, verified fixes, and stable preferences; avoid storing raw secrets or transient logs.

## Compatibility Notes

EverCore-compatible runtimes may expose different group listing behavior. If remote group listing is unavailable, `evercore_list_spaces` still returns current/config-derived spaces and reports the limitation in the response.

Raw message history uses search fallback because some EverCore runtimes only support extracted memory types through `/api/v1/memories/get`.

## Maintainer Checks

```bash
npm run test
npm run tools
npm pack --dry-run
```

Networked smoke tests require an explicit EverCore endpoint:

```bash
EVERCORE_BASE_URL="http://localhost:1995" npm run smoke
EVERCORE_BASE_URL="http://localhost:1995" npm run high-level-tools
```
