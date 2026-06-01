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

### Option A: Direct Run via Git (Recommended - No manual clone required)

For teams or other environments, you can run the server directly from the Git repository using `npx`:

```json
{
  "mcpServers": {
    "evercore-memory": {
      "command": "npx",
      "args": [
        "-y",
        "git+ssh://git@gitlab.example.com/my-org/evercore-memory-tools.git"
      ],
      "env": {
        "EVERCORE_BASE_URL": "https://evercore.example.com",
        "EVERCORE_DEFAULT_USER_ID": "wei"
      }
    }
  }
}
```

### Option B: Local Development / Custom Path

If you are developing locally and want to load the server from your local workspace, use `node` with your absolute clone path:

```json
{
  "mcpServers": {
    "evercore-memory": {
      "command": "node",
      "args": ["/path/to/your/workspace/evercore-memory-tools/bin/evercore-memory-mcp.mjs"],
      "env": {
        "EVERCORE_BASE_URL": "https://evercore.example.com",
        "EVERCORE_DEFAULT_USER_ID": "wei"
      }
    }
  }
}
```

### 🎯 Multi-Project & Workspace Isolation (Deterministic Scoping)

To isolate memories between different projects without changing your global MCP config, you can define **Workspace-Level Configs** using `EVERCORE_DEFAULT_SESSION_ID`.

For example, in the Gemini IDE environment, you can place a local workspace configuration file at **`[your-workspace]/.gemini/config/mcp_config.json`** to override the global setting for this specific folder:

```json
{
  "mcpServers": {
    "evercore-memory": {
      "env": {
        "EVERCORE_DEFAULT_SESSION_ID": "1135-poker"
      }
    }
  }
}
```

This ensures that:

- **Low Coupling**: The `evercore-memory-tools` code remains 100% generic.
- **100% Deterministic**: Memory is strictly isolated at the project/workspace boundary by code, without relying on LLM reasoning.
- **No Global Contamination**: Related sub-projects (like `1135_poker_admin` and `1135_poker_front`) share a unified `1135-poker` memory scope seamlessly, while remaining completely invisible to other workspace environments.

## Tools

- `evercore_health` - checks `/health`
- `evercore_search` - searches memory through `/api/v1/memories/search`
- `evercore_add` - stores personal messages through `/api/v1/memories`
- `evercore_flush` - triggers extraction through `/api/v1/memories/flush`
- `evercore_delete` - soft deletes memories through `/api/v1/memories/delete`

