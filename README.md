# EverCore Memory Tools

This directory contains a local MCP server and an agent skill for using the self-hosted EverCore service at `https://evercore.example.com`.

The MCP server intentionally has no npm dependencies. It speaks the MCP stdio JSON-RPC protocol directly and forwards calls to EverCore HTTP endpoints.

## Layout

- `bin/evercore-memory-mcp.mjs` - stdio MCP server
- `skill/SKILL.md` - agent workflow skill
- `skill/references/payload-examples.md` - EverCore request examples
- `scripts/smoke-test.mjs` - end-to-end EverCore API smoke test
- `scripts/list-tools.mjs` - local MCP protocol smoke test
- `docs/superpowers/plans/2026-06-01-evercore-memory-tools.md` - implementation plan

## Environment

```bash
export EVERCORE_BASE_URL="https://evercore.example.com"
```

Optional:

```bash
export EVERCORE_API_KEY="..."
export EVERCORE_DEFAULT_USER_ID="wei"
```

`EVERCORE_API_KEY` is only needed if the reverse proxy or service later requires bearer auth.

## Run Smoke Tests

```bash
cd /home/wei/workspace/evercore-memory-tools
npm run smoke
npm run tools
```

## MCP Client Config Example

Use this command for clients that support stdio MCP servers:

```json
{
  "mcpServers": {
    "evercore-memory": {
      "command": "node",
      "args": ["/home/wei/workspace/evercore-memory-tools/bin/evercore-memory-mcp.mjs"],
      "env": {
        "EVERCORE_BASE_URL": "https://evercore.example.com",
        "EVERCORE_DEFAULT_USER_ID": "wei"
      }
    }
  }
}
```

## Tools

- `evercore_health` - checks `/health`
- `evercore_search` - searches memory through `/api/v1/memories/search`
- `evercore_add` - stores personal messages through `/api/v1/memories`
- `evercore_flush` - triggers extraction through `/api/v1/memories/flush`
- `evercore_delete` - soft deletes memories through `/api/v1/memories/delete`

