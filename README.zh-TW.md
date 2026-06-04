# EverCore Memory Tools

[English](README.md)

`evercore-memory-tools` 是一套非官方 MCP adapter 與 agent skill workflow，目標是讓 coding agent 使用 self-hosted EverCore-compatible memory service，而不是綁定 EverMemOS Cloud-first 工作流。

這個專案讓 coding agent 能在不同 session 之間保留長期專案記憶，例如決策、慣例、bug 修復、roadmap context，以及依 repo scope 還原 briefing。

MCP server 刻意維持 npm dependency-free。它直接實作 MCP stdio JSON-RPC，並把 tool calls 轉送到 EverCore HTTP endpoints。

## 專案結構

- `bin/evercore-memory-mcp.mjs` - stdio MCP server
- `src/` - 共用 scope、payload、HTTP、safety helpers
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
- `scripts/smoke-test.mjs` - EverCore API end-to-end smoke test
- `scripts/list-tools.mjs` - local MCP protocol smoke test

## 需求

- Node.js 20+
- 一個正在執行的 EverCore-compatible API service

預設 endpoint 是 EverOS local quickstart：

```bash
export EVERCORE_BASE_URL="http://localhost:1995"
```

可選環境變數：

```bash
export EVERCORE_API_KEY="..."
export EVERCORE_DEFAULT_USER_ID="developer"
export EVERCORE_DEFAULT_SESSION_ID="project-slug"
```

只有當你的 reverse proxy 或 service 需要 bearer auth 時，才需要設定 `EVERCORE_API_KEY`。

## 執行 Smoke Tests

```bash
npm run tools
EVERCORE_BASE_URL="http://localhost:1995" npm run smoke
EVERCORE_BASE_URL="http://localhost:1995" npm run high-level-tools
```

`npm run tools` 會驗證 MCP handshake 與 tool schemas。`npm run smoke` 會用 disposable test data 執行 write、search、flush、delete。`npm run high-level-tools` 會透過 MCP JSON-RPC 驗證 MCP-first workflow。

## Coding Memory Workflow

解析目前 repo scope：

```bash
npm run scope
```

輸出範例：

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

從 project memory 產生 session-start Markdown briefing：

```bash
EVERCORE_BASE_URL="http://localhost:1995" npm run briefing
```

Ingest 最新 Codex rollout transcript：

```bash
EVERCORE_BASE_URL="http://localhost:1995" npm run ingest:codex -- --latest
```

使用 `--dry-run` 在不寫入 EverCore 的情況下檢查 resolved scope 與 redacted payloads：

```bash
npm run ingest:codex -- --latest --dry-run
```

ingestion command 會摘要 user requests、assistant final responses、重要 tool outcomes，並在寫入前 redacts 常見 secret patterns。Project summaries 優先寫入 `/api/v1/memories/group`；agent trajectory 會寫入 `/api/v1/memories/agent`。

檢查 spaces、history 與 Codex ingestion status：

```bash
npm run spaces
npm run history -- --scope project --memory-types raw_message,episodic_memory --query "recent decisions"
npm run ingest:status -- --latest
```

## High-Level MCP Workflow

日常 agent workflow 優先使用 high-level tools：

- `evercore_scope` - 解析目前 repo memory scope
- `evercore_briefing` - 產生 Markdown context briefing
- `evercore_remember` - 用 safety checks 寫入 durable project、user、agent memory
- `evercore_recall` - 回傳 normalized memory snippets
- `evercore_forget` - 刪除明確 memory 或已確認的 disposable scope
- `evercore_ingest_codex` - 建立或寫入 Codex rollout summary；預設 dry-run
- `evercore_list_spaces` - 列出目前/config spaces，並在 runtime 支援時列出 remote groups
- `evercore_fetch_history` - 透過 `/get` 與 raw-message search fallback 取得有限 timeline
- `evercore_ingest_status` - 檢查 Codex transcript `source_hash` 是否已存在
- `evercore_request_status` - 從 search evidence 推估有限 request/source status

Low-level tools 保留給精準 debug EverCore API 行為：

- `evercore_health`
- `evercore_search`
- `evercore_add`
- `evercore_flush`
- `evercore_delete`

## MCP Client Config

### 選項 A：從 GitHub 執行

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

### 選項 B：Local Development

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

每個 repo 或 workspace 可設定不同 `EVERCORE_DEFAULT_SESSION_ID`，用來隔離 memory：

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

這讓同一位使用者可以在不同 codebases 之間維持獨立 memory scope，而不需要依賴模型自行推論 scope。

## Tools

- `evercore_scope` - 解析 repo-scoped `group_id`
- `evercore_remember` - 寫入 durable high-level memory
- `evercore_recall` - 搜尋並 normalize memory snippets
- `evercore_briefing` - 產生 session-start Markdown briefing
- `evercore_forget` - guarded delete wrapper
- `evercore_ingest_codex` - Codex transcript ingestion wrapper
- `evercore_list_spaces` - 列出已知 memory spaces
- `evercore_fetch_history` - 取得 scoped memory history
- `evercore_ingest_status` - 檢查 Codex source-hash ingestion state
- `evercore_request_status` - 推估有限 request/source status
- `evercore_health` - 檢查 `/health`
- `evercore_search` - 透過 `/api/v1/memories/search` 搜尋 memory
- `evercore_add` - 透過 `/api/v1/memories` 寫入 personal messages
- `evercore_flush` - 透過 `/api/v1/memories/flush` 觸發 extraction
- `evercore_delete` - 透過 `/api/v1/memories/delete` soft delete memories

## CLI Commands

- `npm run scope` - 印出 resolved repo memory scope
- `npm run briefing` - 產生 Markdown project memory briefing
- `npm run spaces` - 列出 current/config spaces，runtime 支援時也列出 remote groups
- `npm run history` - 取得 scoped memory history
- `npm run ingest:codex -- --latest` - ingest 最新 Codex rollout session
- `npm run ingest:status -- --latest` - 檢查 Codex rollout 是否看起來已 ingest
- `npm run high-level-tools` - 透過 JSON-RPC 驗證 high-level MCP tools
- `npm run test` - 執行 dependency-free unit tests
- `npm run tools` - 驗證 MCP handshake 與 schemas
- `npm run smoke` - 使用 disposable data 執行 EverCore API end-to-end smoke test
- `npm run smoke:remote` - 對你提供的 `EVERCORE_BASE_URL` 執行 smoke test

## 狀態

這是 self-hosted EverCore-compatible API deployments 與 local coding-agent workflows 用的 unofficial adapter。它目前已支援 MCP-first high-level workflow，low-level tools 則保留作為 debug / compatibility layer。

已知限制：目前實測的 self-hosted runtime 雖然在 OpenAPI 暴露 `/api/v1/groups`，但 group listing 可能回 `405 Method Not Allowed`。因此 `evercore_list_spaces` 會固定回傳 local/config-derived spaces，remote listing 不支援時會放在 limitations。
