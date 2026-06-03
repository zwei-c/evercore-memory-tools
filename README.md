# EverCore Memory Tools

Unofficial MCP adapter and agent skill workflow for self-hosted EverCore-compatible memory services.

This project targets local or self-hosted EverCore API deployments, not EverMemOS Cloud-first workflows. It gives coding agents durable project memory across sessions: decisions, conventions, bug fixes, roadmap context, and repo-scoped briefing restore.

The MCP server intentionally has no npm dependencies. It speaks MCP stdio JSON-RPC directly and forwards calls to EverCore HTTP endpoints.

## Layout

- `bin/evercore-memory-mcp.mjs` - stdio MCP server
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
```

`npm run tools` verifies MCP handshake/tool schemas. `npm run smoke` writes, searches, flushes, and deletes disposable test data from the configured EverCore service.

## MCP Client Config

### Option A: Run from GitHub

```json
{
  "mcpServers": {
    "evercore-memory": {
      "command": "npx",
      "args": [
        "-y",
        "git+ssh://git@github.com/zwei-c/evercore-memory-tools.git"
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

- `evercore_health` - checks `/health`
- `evercore_search` - searches memory through `/api/v1/memories/search`
- `evercore_add` - stores personal messages through `/api/v1/memories`
- `evercore_flush` - triggers extraction through `/api/v1/memories/flush`
- `evercore_delete` - soft deletes memories through `/api/v1/memories/delete`

## Status

This is an unofficial adapter. It is intended for self-hosted EverCore-compatible API deployments and local coding-agent workflows.
