# EverCore Memory Tools Implementation Plan

## 目標定位

`evercore-memory-tools` 要做的是一個 EverMem-style coding-agent memory 工具，但後端使用 self-hosted EverCore，且不綁定 Claude Code plugin。

核心定位：

- Inspired by EverMem / Claude Code memory workflows.
- Built for self-hosted EverCore-compatible APIs.
- MCP-first, not Claude-only.
- Intended for Codex, GitHub Copilot, Gemini / Antigravity, Claude Code, Cursor, and other MCP-capable agents.

這個工具不是 EverMind / EverOS 官方 cloud integration，也不是 EverMemOS Cloud-first MCP server。它是針對 self-hosted EverCore 的 unofficial adapter 與 coding-agent workflow。

## 對齊的 Use Case

產品目標對齊 EverMind 的 Claude Code Memory use case：

- 讓 coding agent 不用每次重講專案背景。
- 把 project decisions、conventions、bug fixes、roadmap、workflow history 變成長期記憶。
- 透過 repo / space 隔離不同專案。
- 從 session lifecycle 或 transcript 自動捕捉內容。
- 在新 session 開始時做 briefing / context restore。

差異化實作路線：

- self-hosted EverCore first
- multi-agent first
- MCP tool surface first
- workspace/repo scoped memory first
- transcript/session automation as local tooling

## 現況

目前已完成：

- Node.js dependency-free MCP server。
- MCP stdio JSON-RPC tool surface。
- Codex/RMCP 相容處理：
  - newline-delimited JSON-RPC
  - `serverInfo` / `server_info`
  - `inputSchema` / `input_schema`
- 基本 EverCore tools：
  - `evercore_health`
  - `evercore_search`
  - `evercore_add`
  - `evercore_flush`
  - `evercore_delete`
- `EVERCORE_BASE_URL` 支援 self-host endpoint。
- `EVERCORE_DEFAULT_USER_ID` / `EVERCORE_DEFAULT_SESSION_ID` 支援基本 scope。
- `npm run tools` 離線檢查 MCP handshake / schema。
- `npm run smoke` 端到端檢查 health -> add -> raw search -> flush -> extracted search -> delete。

目前完成度約 35-45%。MCP adapter 已可用，但還不是完整的跨 session coding memory system。

## 與 evermemos-mcp 的關係

`evermemos-mcp` 是 Python / PyPI package，主要對接 EverMemOS Cloud API。它有比較完整的產品化 MCP tool surface：

- `list_spaces`
- `remember`
- `request_status`
- `recall`
- `briefing`
- `forget`
- `fetch_history`

它也有：

- `space_id`
- git auto-detection
- lifecycle states
- sensitive content guard
- conflict detection
- traceable citations
- request status
- history pagination

雖然 `evermemos-mcp` 支援 `EVERMEMOS_BASE_URL` 和 `EVERMEMOS_API_VERSION`，但這只代表 endpoint/version 可設定，不代表 self-hosted EverCore 一定相容 EverMemOS Cloud v0 API contract。

目前 self-hosted EverCore 實際 API surface 是：

- `/health`
- `/api/v1/memories`
- `/api/v1/memories/search`
- `/api/v1/memories/get`
- `/api/v1/memories/flush`
- `/api/v1/memories/delete`
- `/api/v1/memories/group`
- `/api/v1/memories/group/flush`
- `/api/v1/memories/agent`
- `/api/v1/memories/agent/flush`
- `/api/v1/groups`
- `/api/v1/groups/{group_id}`
- `/api/v1/senders`
- `/api/v1/senders/{sender_id}`
- `/api/v1/settings`

結論：不要期待直接改 `evermemos-mcp` base URL 就完整可用。更務實的方向是參考 `evermemos-mcp` 的 tool contract，在 `evercore-memory-tools` 中實作 self-hosted EverCore 版本。

## API 映射方向

建議把高階 tool surface 映射到 EverCore API：

| 高階 Tool | EverCore API | 說明 |
| --- | --- | --- |
| `list_spaces` | `/api/v1/groups` 與本地推導 | EverCore 目前有 group upsert/get，若缺 list，可先用 config/known scopes |
| `remember` | `/api/v1/memories/group` 或 `/api/v1/memories/agent` | coding project memory 優先使用 group/agent memory |
| `recall` | `/api/v1/memories/search` | 包裝 search，支援 multi-space/query presets |
| `briefing` | `/api/v1/memories/search` + `/api/v1/memories/get` | 聚合 conventions、decisions、recent fixes、roadmap |
| `fetch_history` | `/api/v1/memories/get` | 用 page/page_size/rank_by/rank_order 做 timeline |
| `forget` | `/api/v1/memories/delete` | 封裝 delete + pre/post verification |
| `request_status` | flush response / get/search 推估 | 除非 EverCore 增加 request tracking endpoint，先做有限版 |

Scope 映射：

- EverMemOS `space_id` -> EverCore `group_id`
- `coding:zwei-c/workspace` -> `group_id = coding:zwei-c/workspace`
- personal preferences 可用 `user_id`
- project memory 優先用 `group_id`
- agent trajectory 可用 `/api/v1/memories/agent`

## MVP 範圍

第一個可用版本先不要追求完整 EverMemOS parity。目標是讓日常 Codex workflow 先有效：

1. 自動解析 repo scope。
2. 產生 session-start briefing。
3. 可 ingest 最新 Codex session transcript。
4. 可把 session summary 寫入 self-hosted EverCore。
5. 可用 `npm run tools` / smoke command 驗證。

## Phase 1: Scope Resolver

新增 `src/scope.mjs`：

- 讀目前 cwd。
- 判斷是否在 git repo。
- 讀 `git remote get-url origin`。
- 將 remote 轉成穩定 scope：
  - `github:zwei-c/workspace`
  - `gitlab:group/project`
  - fallback: `local:<directory-name>`
- 對 coding memory 產出 `space_id` / `group_id`：
  - `coding:github:zwei-c/workspace`

CLI：

```bash
npm run scope
```

輸出：

```json
{
  "cwd": "...",
  "repo_root": "...",
  "remote": "git@github.com:zwei-c/workspace.git",
  "space_id": "coding:github:zwei-c/workspace"
}
```

## Phase 2: Briefing

新增高階 MCP tool 或 CLI：

- `briefing`
- 或先做 `scripts/briefing.mjs`

固定查詢：

- project conventions
- recent architecture decisions
- known pitfalls
- recent bug fixes
- open roadmap / next steps
- workflow preferences

輸出 Markdown：

```md
# Project Memory Briefing

## Conventions

## Recent Decisions

## Known Pitfalls

## Recent Fixes

## Roadmap

## Suggested Context For This Session
```

CLI：

```bash
npm run briefing
```

MCP tool 後續命名：

```text
evercore_briefing
```

## Phase 3: Codex Transcript Ingestion

先只支援 Codex：

```bash
npm run ingest:codex -- --latest
```

來源：

```text
~/.codex/sessions/**/rollout-*.jsonl
```

抽取內容：

- session cwd
- user requests
- assistant final responses
- important tool outcomes
- verification evidence
- commits / pushed branches
- blockers
- decisions

寫入策略：

- raw agent trajectory -> `/api/v1/memories/agent`
- project summary -> `/api/v1/memories/group`
- flush -> `/api/v1/memories/agent/flush` 或 `/api/v1/memories/group/flush`

先不要做完美分類；先確保能把最新 session 的有價值內容可靠送進 EverCore。

## Phase 4: Higher-Level Tool Surface

逐步補齊 EverMem-style tools：

- `remember`
- `recall`
- `briefing`
- `fetch_history`
- `forget`
- `list_spaces`

保留現有 low-level tools 作為 debug / compatibility layer：

- `evercore_health`
- `evercore_search`
- `evercore_add`
- `evercore_flush`
- `evercore_delete`

高階 tools 給日常 agent 使用；低階 tools 給診斷與精準操作。

## Phase 5: Memory Quality

新增品質控制：

- sensitive content guard
  - API keys
  - tokens
  - passwords
  - private keys
  - `.env` dumps
- conflict detection
  - 查相同 space 內是否已有相反 decision
- dedupe
  - 避免同一 session summary 重複 ingest
- importance scoring
  - 過濾低價值 transcript filler
- category labels
  - decision
  - convention
  - bugfix
  - roadmap
  - preference
  - blocker

## Phase 6: Multi-Agent Adapters

Codex MVP 穩定後再擴展：

- Gemini / Antigravity
- GitHub Copilot / VSCode
- Claude Code hook / plugin
- Cursor

每家工具只做 adapter，不改核心 memory model。

## Publishing Path

目前 repo 是 Node.js package。若要進 MCP store / registry 類生態，建議走 npm 路線：

1. 補高階 tool surface。
2. 將 `package.json` 從 private package 改成可 publish。
3. 使用 scoped package，例如：

```json
{
  "name": "@zwei-c/evercore-memory-tools"
}
```

4. README 提供標準 MCP config：

```json
{
  "mcpServers": {
    "evercore-memory": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@zwei-c/evercore-memory-tools"],
      "env": {
        "EVERCORE_BASE_URL": "http://localhost:1995",
        "EVERCORE_DEFAULT_USER_ID": "developer"
      }
    }
  }
}
```

5. 補 registry metadata，例如 `server.json`。
6. 發 npm。
7. 再考慮提交到官方 MCP Registry、Glama、Smithery、mcp.so 等目錄。

## 非目標

現階段不要做：

- 完整 EverMemOS Cloud API clone。
- 直接 fork `evermemos-mcp` 並大改成 self-host EverCore。
- 同時支援所有 coding agents。
- 在 workspace root repo 追蹤工具本體。
- 存 secrets、完整 `.env`、private tokens、內部 runtime logs。

## 風險與待確認

- EverCore 是否有正式 list groups endpoint；目前 OpenAPI 看到 create/get group，但未確認 list。
- `request_status` 是否能可靠實作；目前 flush response 有 status，但不是 EverMemOS 那種完整 lifecycle。
- `/api/v1/memories/agent` 是否比 group memory 更適合作為 Codex transcript ingestion 入口。
- `agent_memory` 搜尋結果品質需要用真實 coding sessions 驗證。
- transcript ingestion 需要嚴格做 secrets filter。
- workspace skill 與 tool repo skill 需要避免分叉。

## 建議下一步

第一個開發批次：

1. 新增 `src/scope.mjs` 和 `npm run scope`。
2. 新增 `scripts/briefing.mjs` 和 `npm run briefing`。
3. 新增 `scripts/ingest-codex-session.mjs --latest`。
4. 同步 workspace 的 `skills/maintained/evercore-memory/SKILL.md` 到 tool repo 的 generic skill 版本。
5. 增加 smoke test 覆蓋 briefing/search/get 的基本流程。

完成這批後，這個工具就能從「可用 MCP adapter」升級成「每天真的能幫 coding session restore context 的 MVP」。
