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
- 共用 `src/` 核心：
  - `src/config.mjs`
  - `src/http.mjs`
  - `src/payloads.mjs`
  - `src/scope.mjs`
  - `src/utils.mjs`
- `npm run scope` 可解析目前 repo scope / `group_id`。
- `npm run briefing` 可用目前 repo scope 產生 Markdown briefing。
- `npm run ingest:codex -- --latest` 可解析最新 Codex rollout transcript，產生 project summary 與 agent trajectory payload。
- `npm run ingest:codex -- --latest --dry-run` 可在不寫入 EverCore 的情況下檢查 redacted payload。
- `npm run smoke` 已擴充覆蓋 personal、group、agent 三條 EverCore memory 寫入/搜尋/flush/delete 路徑。
- 高階 MCP tools 已完成：
  - `evercore_scope`
  - `evercore_remember`
  - `evercore_recall`
  - `evercore_briefing`
  - `evercore_forget`
  - `evercore_ingest_codex`
- 第二批核心已抽成共用模組：
  - `src/briefing.mjs`
  - `src/codex-ingest.mjs`
  - `src/safety.mjs`
  - `src/tools.mjs`
- `scripts/test.mjs` 已提供 dependency-free tests。
- `scripts/high-level-tools-smoke.mjs` 已覆蓋 MCP high-level workflow：
  - `evercore_scope`
  - `evercore_ingest_codex` dry-run
  - `evercore_remember` -> `evercore_recall` -> `evercore_forget`
- 第三階段 high-level tools 已完成：
  - `evercore_list_spaces`
  - `evercore_fetch_history`
  - `evercore_ingest_status`
  - `evercore_request_status`
- 第三階段 CLI 已完成：
  - `npm run spaces`
  - `npm run history`
  - `npm run ingest:status`
- 第三階段核心已抽成共用模組：
  - `src/spaces.mjs`
  - `src/history.mjs`
  - `src/status.mjs`
  - `src/memory-text.mjs`
- 發布準備已新增 `server.json` draft，並可用 `npm pack --dry-run` 檢查 package contents。
- 已用一個 self-hosted remote EverCore endpoint 驗證：
  - `/health`
  - `/openapi.json`
  - MCP tools handshake
  - briefing CLI
  - disposable smoke test
  - high-level MCP workflow smoke test
  - group add runtime 需要 `messages[].sender_id`，實作已補上。
  - raw group recall 需對 `raw_message` 使用 keyword search，實作已在 `include_raw` 時分段查詢。
  - `/api/v1/groups` remote list 在目前 runtime 可能回 405；`evercore_list_spaces` 會回 local/config spaces 並把 remote limitation 放在 `limitations`。
  - `/api/v1/memories/get` 僅支援 extracted memory types；`raw_message` history 走 `/api/v1/memories/search` fallback。

目前完成度約 90-95%。MCP adapter、第一批/第二批 coding memory MVP、第三階段 history/status/dedupe visibility 與 publishing readiness 已可用；日常 workflow 可從 MCP high-level tools 完成 scope、briefing、remember、recall、forget、history、spaces、Codex ingest dry-run/status，並已用遠端 self-hosted EverCore 跑通 disposable E2E smoke。

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
- `coding:example-org/workspace` -> `group_id = coding:example-org/workspace`
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
  - `github:example-org/workspace`
  - `gitlab:group/project`
  - fallback: `local:<directory-name>`
- 對 coding memory 產出 `space_id` / `group_id`：
  - `coding:github:example-org/workspace`

CLI：

```bash
npm run scope
```

輸出：

```json
{
  "cwd": "...",
  "repo_root": "...",
  "remote": "git@github.com:example-org/workspace.git",
  "space_id": "coding:github:example-org/workspace"
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
  "name": "@example-org/evercore-memory-tools"
}
```

4. README 提供標準 MCP config：

```json
{
  "mcpServers": {
    "evercore-memory": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@example-org/evercore-memory-tools"],
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

第一個開發批次已完成：

1. 新增 `src/scope.mjs` 和 `npm run scope`。
2. 新增 `scripts/briefing.mjs` 和 `npm run briefing`。
3. 新增 `scripts/ingest-codex-session.mjs --latest`。
4. 增加 smoke test 覆蓋 personal、group、agent memory 的基本流程。

## 第二批實作計畫：MCP-first High-Level Workflow（已完成）

### 批次目標

第二批已把 CLI-first MVP 升級成 MCP-first coding memory workflow。日常 agent 不需要先 shell out 到 CLI，也能透過 MCP tool 完成：

- 解析目前 repo scope。
- 寫入 repo-scoped memory。
- 查詢 repo/project/user memory。
- 產生 session-start briefing。
- 安全刪除指定 memory 或測試 scope。
- 從最近的 Codex transcript 產生可寫入摘要。

低階 tools 繼續保留作為 debug / compatibility layer；高階 tools 才是日常 agent workflow 的主入口。

### 交付範圍

第二批已交付 6 個高階 MCP tools：

1. `evercore_scope`
2. `evercore_remember`
3. `evercore_recall`
4. `evercore_briefing`
5. `evercore_forget`
6. `evercore_ingest_codex`

仍暫緩：

- `request_status`
- `fetch_history`
- `list_spaces`
- registry / npm publish
- 多 agent adapters

這些項目等第三批再排，避免 tool surface 一次膨脹過快。

### Tool Contract

#### `evercore_scope`

用途：回傳目前 cwd 對應的 coding memory scope。

Input：

```json
{
  "cwd": "/optional/path"
}
```

Output：

```json
{
  "cwd": "...",
  "repo_root": "...",
  "remote": "git@github.com:example-org/evercore-memory-tools.git",
  "repo_scope": "github:example-org/evercore-memory-tools",
  "space_id": "coding:github:example-org/evercore-memory-tools",
  "group_id": "coding:github:example-org/evercore-memory-tools"
}
```

Implementation：

- 直接共用 `src/scope.mjs`。
- 不呼叫 EverCore API。
- `cwd` 預設 `process.cwd()`。

#### `evercore_remember`

用途：寫入 durable project/user memory。這是高階版 `evercore_add` / group add。

Input：

```json
{
  "content": "Decision: use group-scoped memory for project context.",
  "scope": "project",
  "category": "decision",
  "importance": 0.8,
  "group_id": "coding:github:example-org/evercore-memory-tools",
  "user_id": "developer",
  "session_id": "optional-session",
  "sender_id": "codex",
  "flush": true
}
```

Rules：

- `scope = project` 預設寫 `/api/v1/memories/group`。
- `scope = user` 寫 `/api/v1/memories`。
- `scope = agent` 寫 `/api/v1/memories/agent`。
- `group_id` 沒給時用 `resolveScope().group_id`。
- project/group messages 必須補 `sender_id`，預設 `codex`。
- 寫入前跑 sensitive content guard。
- 若 guard 命中 high-confidence secret，回傳 error，不寫入。
- `flush = true` 時同步呼叫對應 flush endpoint。

Output：

```json
{
  "ok": true,
  "scope": "project",
  "group_id": "...",
  "session_id": "...",
  "category": "decision",
  "write_result": {},
  "flush_result": {}
}
```

#### `evercore_recall`

用途：查詢 user/project/agent memory。這是高階版 `evercore_search`。

Input：

```json
{
  "query": "What decisions did we make about Codex transcript ingestion?",
  "scope": "project",
  "group_id": "coding:github:example-org/evercore-memory-tools",
  "user_id": "developer",
  "categories": ["decision", "convention"],
  "top_k": 5,
  "include_raw": false
}
```

Rules：

- `scope = project` 預設 filter `{ "group_id": resolved.group_id }`。
- `scope = user` filter `{ "user_id": defaultUserId }`。
- `scope = all` 要求至少有 `user_id` 或 `group_id`，不允許無 filter broad search。
- 預設 `memory_types = ["episodic_memory", "profile", "agent_memory"]`。
- `include_raw = true` 時加 `raw_message`，但只建議 debug / very recent ingestion 用。
- 回傳 normalized snippets，保留原始 result 在 `raw_result` 可選欄位。

Output：

```json
{
  "query": "...",
  "filters": {},
  "snippets": [
    {
      "type": "episodic_memory",
      "text": "...",
      "score": 0.92,
      "memory_id": "..."
    }
  ]
}
```

#### `evercore_briefing`

用途：產生 session-start Markdown briefing。MCP 版應與 `npm run briefing` 使用同一套核心。

Input：

```json
{
  "cwd": "/optional/path",
  "group_id": "optional",
  "user_id": "developer",
  "top_k": 5,
  "format": "markdown"
}
```

Output：

```json
{
  "group_id": "...",
  "markdown": "# Project Memory Briefing\n..."
}
```

Implementation：

- 將目前 `scripts/briefing.mjs` 的查詢與 render 邏輯抽到 `src/briefing.mjs`。
- CLI 改成 thin wrapper。
- MCP tool 直接呼叫 `buildBriefing()`。
- 若查無 memory，回傳完整空 briefing，不視為錯誤。

#### `evercore_forget`

用途：安全刪除 memory / test scope。高階版 `evercore_delete`。

Input：

```json
{
  "memory_id": "optional",
  "group_id": "optional",
  "user_id": "optional",
  "session_id": "optional",
  "sender_id": "optional",
  "confirm": "delete"
}
```

Rules：

- 必須有 `memory_id`，或至少一組明確 scope：
  - `group_id`
  - `user_id + session_id`
  - `user_id + sender_id`
- 若是 scope delete，必須 `confirm = "delete"`。
- 不提供 `confirm` 時只回傳 would-delete payload。
- 不允許無 scope delete。

#### `evercore_ingest_codex`

用途：從 Codex rollout transcript 產生 project summary / agent trajectory，並可寫入 EverCore。

Input：

```json
{
  "latest": true,
  "file": "/optional/rollout.jsonl",
  "dry_run": true,
  "group_id": "optional",
  "user_id": "developer",
  "flush": true
}
```

Rules：

- 將目前 `scripts/ingest-codex-session.mjs` parser / summarizer 抽到 `src/codex-ingest.mjs`。
- CLI 改成 thin wrapper。
- 預設 `dry_run = true`，MCP 呼叫要明確 `dry_run = false` 才會寫入。
- 寫入前跑 sensitive content guard。
- group summary 寫 `/api/v1/memories/group`。
- agent trajectory 寫 `/api/v1/memories/agent`。
- `messages[].sender_id` 必須補 `codex`。
- flush group 用 `{ group_id }`，flush agent 用 `{ user_id, session_id }`。

### Core Refactor

第二批已完成小幅抽取，避免 MCP server 與 CLI 分叉：

- `src/briefing.mjs`
  - `buildBriefing(options, client)`
  - `renderBriefing(data)`
  - `extractSnippets(result)`
- `src/codex-ingest.mjs`
  - `latestCodexSessionPath()`
  - `parseCodexSession(file)`
  - `buildSessionSummary(parsed)`
  - `buildCodexIngestPayloads(options)`
  - `ingestCodexSession(options, client)`
- `src/safety.mjs`
  - `redactSensitiveText(text)`
  - `detectSensitiveText(text)`
  - `assertSafeToStore(text)`
- `src/tools.mjs`
  - MCP tool schema definitions
  - `callTool(name, args, context)`

目前 `src/utils.mjs` 已保留純工具函式，redaction / detection 已搬到 `src/safety.mjs`。

### MCP Schema 原則

- 繼續同時輸出 `inputSchema` / `input_schema`。
- 避免 `oneOf` / `anyOf` / `allOf`，維持目前 `npm run tools` 的相容性檢查。
- 所有 destructive tool 都要有明確 guard。
- 所有 networked tool error 都要回傳 HTTP method/path/status 與 EverCore response body 摘要。
- high-level tools 回傳 human-readable summary，但保留 machine-readable fields。

### Safety / Quality

第二批已完成：

- secret detection：
  - API key / token / secret / password assignment
  - bearer token
  - private key block
  - common `sk-*` / `pk-*` style token
- transcript filtering：
  - 跳過 Codex bootstrap / environment context
  - 跳過超大 tool output 原文
  - 保留 command success/failure evidence
- dedupe v1：
  - 對 Codex session summary 產生 `source_hash`
  - dry-run 顯示 hash
  - 寫入前先查同 group/session 是否已有同 hash marker
  - 若已存在，預設 skip，除非 `force = true`
- category labels：
  - `decision`
  - `convention`
  - `bugfix`
  - `roadmap`
  - `preference`
  - `blocker`
  - `verification`

### 測試與驗證

已新增 npm scripts：

```json
{
  "test": "node ./scripts/test.mjs",
  "smoke:remote": "node -e \"if (!process.env.EVERCORE_BASE_URL) throw new Error('Set EVERCORE_BASE_URL before running smoke:remote')\" && npm run smoke"
}
```

`scripts/test.mjs` 先用 dependency-free assertions：

- `scopeFromRemote()`：
  - GitHub SSH
  - GitHub HTTPS
  - GitLab SSH
  - local fallback
- sensitive detection：
  - token assignment 要 block
  - normal project decision 要 pass
- Codex parser fixture：
  - bootstrap context skipped
  - user request captured
  - assistant final captured
  - huge tool output summarized
- briefing renderer：
  - empty result renders stable headings
  - snippets render under expected headings
- MCP tools list：
  - expected low-level tools still present
  - expected high-level tools present
  - no unsupported schema keywords

遠端驗證：

```bash
EVERCORE_BASE_URL=<self-hosted-evercore-url> npm run tools
EVERCORE_BASE_URL=<self-hosted-evercore-url> npm run smoke
EVERCORE_BASE_URL=<self-hosted-evercore-url> EVERCORE_DEFAULT_USER_ID=developer npm run briefing -- --user-only --top-k 2
npm run ingest:codex -- --latest --dry-run
```

MCP high-level tool smoke 已新增到 `scripts/high-level-tools-smoke.mjs`：

- call `evercore_scope`
- call `evercore_briefing`
- call `evercore_remember` with disposable group
- call `evercore_recall`
- call `evercore_forget` with disposable group

### 文件更新

第二批已同步更新：

- `README.md`
  - high-level tools usage
  - Codex ingest examples
  - remote smoke examples
- `skill/SKILL.md`
  - MCP-first workflow
  - 何時用 high-level vs low-level tools
- `skill/references/payload-examples.md`
  - group add 必須帶 `messages[].sender_id`
  - agent add/flush examples
- `docs/implementation-plan.md`
  - 第二批已標成 completed
  - 第三批候選如下

### 非目標

第二批不要做：

- package publish / registry submission。
- 完整 EverMemOS tool parity。
- Claude Code / Cursor / Gemini adapters。
- production-grade request lifecycle tracking。
- 需要資料庫或外部 dependency 的測試框架。
- 自動 ingest 所有歷史 Codex sessions。

### 完成定義

第二批已滿足：

- `npm run tools` 通過，且列出 low-level + high-level tools。
- `npm run test` 通過。
- `npm run smoke` 在 self-hosted remote EverCore endpoint 通過。
- `evercore_scope` / `evercore_briefing` 可透過 MCP protocol smoke 呼叫。
- `evercore_remember` -> `evercore_recall` -> `evercore_forget` 可用 disposable group 跑通。
- `evercore_ingest_codex` 預設 dry-run，不會意外寫入。
- 文件說明 high-level tools 是日常入口，low-level tools 是 debug 入口。

## 第三階段實作計畫：History、Dedupe、Publishing Readiness（已完成）

### 完成紀錄

第三階段已交付：

- `evercore_list_spaces`：回傳 current repo scope、env/config scope，並在 remote group list 不支援時回 `limitations`。
- `evercore_fetch_history`：extracted memory types 使用 `/api/v1/memories/get`；`raw_message` 使用 `/api/v1/memories/search` fallback。
- `evercore_ingest_status`：以 `source_hash` 或 latest/file Codex rollout 推估 `not_found` / `raw_found` / `extracted_found` / `ambiguous`。
- `evercore_request_status`：在沒有 dedicated lifecycle endpoint 的前提下，從 `request_id` 或 `source_hash` 做有限推估並回報 confidence/limitations。
- `evercore_recall.categories`：以 category marker 改寫 query，先支援文字 marker 策略。
- `evercore_ingest_codex`：寫入前共用 `getCodexIngestStatus()` 做 source-hash dedupe，`force=true` 時可列出 previous matches。
- CLI：`npm run spaces`、`npm run history`、`npm run ingest:status`。
- Publishing readiness：新增 `server.json` draft，並納入 `npm pack --dry-run` 驗證。

第三階段保留的已知限制：

- 目前 self-hosted runtime 沒有完整 request lifecycle endpoint，`evercore_request_status` 只能做 evidence-based inference。
- 目前 `/api/v1/groups` GET list 在實測 runtime 可能回 405，space list 會以 local/config scope 為主。
- `raw_message` history 不能走 `/memories/get`，必須用 keyword search fallback。
- 尚未實際 npm publish，也尚未提交 MCP registry。

### 階段目標

第三階段已把第二批的 MCP-first MVP 推進到「可追蹤、可審計、可準備發布」的狀態。重點不是再增加很多日常 tool，而是補齊 memory lifecycle 的可見性：

- 能列出目前已知 project spaces。
- 能查詢 repo/user/session 的 history。
- 能知道 Codex transcript 是否已 ingest 過。
- 能用更可靠的 dedupe strategy 避免重複寫入。
- 能提供有限版 request/status 查詢，明確說明可推估與不可推估的邊界。
- 能準備 npm / MCP registry 所需 metadata，但先不正式 publish。

### 交付範圍

第三階段已交付 4 個高階 MCP tools 與 3 個 CLI：

1. `evercore_list_spaces`
2. `evercore_fetch_history`
3. `evercore_ingest_status`
4. `evercore_request_status`
5. `npm run history`
6. `npm run spaces`
7. `npm run ingest:status`

同時強化既有：

- `evercore_ingest_codex`
- `evercore_remember`
- `evercore_recall`
- `scripts/test.mjs`
- `scripts/high-level-tools-smoke.mjs`
- README / skill / payload examples

暫緩到第四階段：

- 真正 npm publish。
- 官方 MCP Registry / Glama / Smithery / mcp.so submission。
- Claude Code / Cursor / Gemini adapters。
- production-grade async request lifecycle。
- 本地 sqlite cache 或 persistent index。

### Tool Contract

#### `evercore_list_spaces`

用途：列出目前工具已知的 memory spaces / groups。

Input：

```json
{
  "cwd": "/optional/path",
  "include_remote": true,
  "include_config": true,
  "include_current": true
}
```

Output：

```json
{
  "spaces": [
    {
      "space_id": "coding:github:example-org/evercore-memory-tools",
      "group_id": "coding:github:example-org/evercore-memory-tools",
      "source": "current_repo",
      "repo_root": "/home/user/workspace/projects/evercore-memory-tools"
    }
  ],
  "limitations": [
    "EverCore exposes group upsert/get but no confirmed list-all endpoint in the current runtime."
  ]
}
```

Rules：

- `include_current = true` 時 always include `resolveScope(cwd)`.
- `include_config = true` 時 include `EVERCORE_DEFAULT_GROUP_ID` / `EVERCORE_DEFAULT_SESSION_ID` derived scope if present.
- `include_remote = true` 時先探測 `/api/v1/groups` 是否支援 GET list：
  - 若支援，normalize remote groups。
  - 若不支援，回傳 limitation，不視為錯誤。
- 不用 local persistent cache；第三階段先保持 stateless。

Implementation：

- 新增 `src/spaces.mjs`
  - `listKnownSpaces(options, client)`
  - `normalizeGroupRecord(record)`
  - `probeRemoteGroups(client)`

#### `evercore_fetch_history`

用途：查詢 repo/user/session 的 memory timeline。這是有限版 EverMem-style `fetch_history`。

Input：

```json
{
  "scope": "project",
  "group_id": "coding:github:example-org/evercore-memory-tools",
  "user_id": "developer",
  "session_id": "optional-session",
  "memory_types": ["raw_message", "episodic_memory", "agent_memory"],
  "page": 1,
  "page_size": 20,
  "rank_by": "created_at",
  "rank_order": "desc"
}
```

Output：

```json
{
  "items": [
    {
      "type": "raw_message",
      "memory_id": "...",
      "text": "...",
      "created_at": "...",
      "session_id": "...",
      "group_id": "..."
    }
  ],
  "page": 1,
  "page_size": 20,
  "has_more": false,
  "source_endpoint": "/api/v1/memories/get"
}
```

Rules：

- 優先使用 `/api/v1/memories/get`。
- 若 endpoint contract 不支援 requested filters，回傳清楚 error 與 supported fallback。
- 若 `scope = project`，filter 用 `group_id`。
- 若 `scope = user`，filter 用 `user_id`。
- 若帶 `session_id`，加到 filters。
- 預設只回摘要 text，不回完整 raw payload；`include_raw_result` 才回原始 response。

Implementation：

- `src/history.mjs`
  - `fetchHistory(options, client)`
  - `buildHistoryPayload(options)`
  - `normalizeHistoryItems(result)`
- `EverCoreClient.getMemories(payload)` 封裝 `/memories/get`。

#### `evercore_ingest_status`

用途：查詢某個 Codex rollout 或 `source_hash` 是否已 ingest。

Input：

```json
{
  "latest": true,
  "file": "/optional/rollout.jsonl",
  "source_hash": "optional",
  "group_id": "optional",
  "user_id": "developer"
}
```

Output：

```json
{
  "source_hash": "...",
  "group_id": "...",
  "status": "not_found",
  "matches": []
}
```

Status values：

- `not_found`
- `raw_found`
- `extracted_found`
- `ambiguous`

Rules：

- 若未提供 `source_hash`，用 `buildCodexIngestPayloads()` 產生，不寫入。
- 對 group memory 先 keyword search `raw_message`。
- 再 search `episodic_memory` / `agent_memory`。
- 如果多個 scope 命中同 hash，回 `ambiguous` 並列出 matches。
- 這個 tool 是 dedupe 的可觀測版本，`evercore_ingest_codex` 也要共用它。

Implementation：

- `src/codex-ingest.mjs`
  - 新增 `getCodexIngestStatus(options, client)`
  - `hasExistingSourceHash()` 改用 status result，不再只回 boolean。

#### `evercore_request_status`

用途：有限版 request/status 查詢。EverCore 目前沒有完整 EverMemOS request lifecycle endpoint，所以此 tool 要明確回報推估來源。

Input：

```json
{
  "request_id": "optional",
  "source_hash": "optional",
  "group_id": "optional",
  "user_id": "optional",
  "session_id": "optional"
}
```

Output：

```json
{
  "status": "unknown",
  "confidence": "low",
  "evidence": [
    "No dedicated request status endpoint is available in this EverCore runtime."
  ],
  "limitations": []
}
```

Status values：

- `accepted`
- `accumulated`
- `extracted`
- `deleted`
- `not_found`
- `unknown`

Rules：

- 如果 input 有 `request_id`，先 search raw/history 是否能找到相同 request_id。
- 如果 input 有 `source_hash`，委派 `evercore_ingest_status`。
- 如果只有 scope，回 `unknown` 並要求更精準 identifier。
- 不假裝有完整 lifecycle；confidence 必須是 `low` / `medium` / `high`。

Implementation：

- `src/status.mjs`
  - `getRequestStatus(options, client)`
  - `inferStatusFromSearch(result)`

### CLI Scope

新增：

```bash
npm run spaces
npm run history -- --scope project --page-size 20
npm run ingest:status -- --latest
```

### Dedupe / Metadata Strategy

第三階段要把第二批的 dedupe v1 做完整：

- `source_hash` 生成規則固定並文件化：
  - session id
  - cwd / repo scope
  - user requests
  - assistant finals
  - important tool outcomes
- group summary 內容保留 `Source Hash: <hash>`。
- `group_meta.source_hash` 繼續寫入，但不依賴 metadata 一定可 search。
- dedupe 查詢順序：
  1. `raw_message` keyword search `source_hash`
  2. `episodic_memory` / `agent_memory` hybrid or keyword search
  3. history endpoint search if available
- `evercore_ingest_codex` 行為：
  - default：若 found，skip。
  - `force = true`：仍寫入，但 output 必須列出 previous matches。
  - `dry_run = true`：永遠不寫入，回 resolved payload；狀態查詢由 `evercore_ingest_status` / `npm run ingest:status` 負責。

### Category / Importance Strategy

第二批目前用文字 marker：

```text
[category:decision] [importance:0.8] ...
```

第三階段先保留文字 marker，但補上更一致的 metadata：

- project/group write：
  - `group_meta.category`
  - `group_meta.importance`
  - `group_meta.source`
- personal/agent write：
  - message `sender_id`
  - message `sender_name`
  - content marker

搜尋策略：

- `evercore_recall` 接受 `categories`。
- 若 categories 存在，把 query 改寫為：

```text
category:decision <original query>
```

- 若 EverCore 後續支援 metadata filters，再把 category 查詢搬到 filters。

### Core Refactor

新增模組：

- `src/spaces.mjs`
- `src/history.mjs`
- `src/status.mjs`

調整既有模組：

- `src/http.mjs`
  - `getMemories(payload)`
  - `listGroups()`，如果 GET `/groups` 可用
- `src/tools.mjs`
  - 新增 tool schemas
  - schemas 繼續避免 `oneOf` / `anyOf` / `allOf`
- `src/codex-ingest.mjs`
  - `getCodexIngestStatus()`
  - `hasExistingSourceHash()` 回傳 structured result
- `scripts/test.mjs`
  - history/status/spaces unit tests

### 測試與驗證

本地 tests：

- `listKnownSpaces()`
  - current repo scope
  - env-derived scope
  - remote groups unsupported fallback
- `fetchHistory()`
  - payload builder
  - normalized raw message with `content_items`
  - pagination fields
- `getCodexIngestStatus()`
  - not found
  - raw found
  - extracted found
  - ambiguous
- `getRequestStatus()`
  - source_hash path
  - unknown without identifier
- `evercore_recall categories`
  - query rewrite
  - no category keeps original query

MCP smoke：

- extend `scripts/high-level-tools-smoke.mjs`
  - `evercore_list_spaces`
  - `evercore_fetch_history` on disposable group
  - `evercore_ingest_status` dry-run/not_found
  - `evercore_request_status` unknown/source_hash path

Remote verification：

```bash
EVERCORE_BASE_URL=<self-hosted-evercore-url> npm run tools
EVERCORE_BASE_URL=<self-hosted-evercore-url> npm run test
EVERCORE_BASE_URL=<self-hosted-evercore-url> npm run high-level-tools
EVERCORE_BASE_URL=<self-hosted-evercore-url> npm run smoke
npm run ingest:codex -- --latest --dry-run
```

若 `GET /api/v1/groups` 不支援 list，測試應確認 limitation 被正常回傳，而不是失敗。

### Documentation

第三階段完成時同步更新：

- `README.md`
  - history / spaces / status tools
  - dedupe behavior
  - publish readiness note
- `README.zh-TW.md`
  - 與英文 README 保持同等資訊量
- `skill/SKILL.md`
  - session start：`evercore_briefing`
  - before ingest：`evercore_ingest_status`
  - history audit：`evercore_fetch_history`
- `skill/references/payload-examples.md`
  - `/memories/get`
  - group list supported/unsupported example
  - request status limitation
- `docs/implementation-plan.md`
  - 第三階段標成 completed
  - 第四階段 publish plan

### Publishing Readiness

第三階段只準備，不發布；目前已新增 `server.json` draft：

- 決定 package name：
  - keep `evercore-memory-tools`
  - or scoped `@example-org/evercore-memory-tools`
- 決定 `private` 是否保留。
- 新增 `server.json` draft：
  - name
  - description
  - command examples
  - environment variables
  - license placeholder
- README 增加 registry/publishing section，但標明 not published yet。
- 確認 bin entrypoint 在 `npm pack --dry-run` 會包含必要檔案。

驗證：

```bash
npm pack --dry-run
node ./bin/evercore-memory-mcp.mjs
```

`node ./bin/evercore-memory-mcp.mjs` 只需確認不會在沒有 stdin request 時崩潰；不用長時間掛著。

### 非目標

第三階段不要做：

- 實際 npm publish。
- 實際 registry submission。
- 新增外部資料庫或 cache dependency。
- 全量歷史 Codex sessions 自動 ingest。
- 宣稱完整 EverMemOS parity。
- 實作不存在的 request lifecycle guarantee。

### 完成定義

第三階段完成需同時滿足：

- `npm run tools` 通過，列出第二批與第三批 tools。
- `npm run test` 通過。
- `npm run high-level-tools` 在 self-hosted remote EverCore endpoint 通過。
- `npm run smoke` 在 self-hosted remote EverCore endpoint 通過。
- `evercore_list_spaces` 在 remote group list unsupported 時回 limitation。
- `evercore_fetch_history` 可用 disposable group 查到 raw history。
- `evercore_ingest_status` 能回 `not_found` 與 `raw_found`。
- `evercore_ingest_codex` 遇到 existing `source_hash` 會 skip，`force = true` 會明確報告覆寫。
- README / README.zh-TW / skill docs 都描述第三階段 tools。
- `npm pack --dry-run` 可檢查 package contents。

第三階段完成後，這個工具已從 MCP-first MVP 進一步往可發布、可追蹤 history、可長期維護的 memory adapter 前進。

## 第四階段候選：Publish、Adapters、Lifecycle

第四階段建議只在第三階段遠端驗證穩定後推進：

- 決定 package name 與 `private` policy，正式 npm publish。
- 補正式 license、registry metadata，評估 MCP Registry / Glama / Smithery / mcp.so submission。
- 增加 Claude Code / Cursor / Gemini adapters，但核心 memory model 維持不分叉。
- 若 EverCore 後端新增 request lifecycle endpoint，再把 `evercore_request_status` 從 search inference 升級成正式 lifecycle 查詢。
- 評估是否需要 local cache；沒有明確需求前仍保持 dependency-free、stateless。
