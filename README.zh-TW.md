# EverCore Memory Tools

[English](README.md)

這是一個讓 coding agent 使用 self-hosted EverCore-compatible memory service 的 MCP server。

它讓 agent 能在不同 session 之間保留長期專案記憶，例如決策、慣例、bug 修復、roadmap context、repo-scoped recall，以及 Codex session 摘要。

## 需求

- Node.js 20+
- 一個正在執行的 EverCore-compatible API service

```bash
export EVERCORE_BASE_URL="http://localhost:1995"
export EVERCORE_DEFAULT_USER_ID="developer"
```

只有當你的 EverCore endpoint 需要 bearer auth 時，才需要設定 `EVERCORE_API_KEY`。

## MCP 設定

透過 `npx` 使用 npm package：

```json
{
  "mcpServers": {
    "evercore-memory": {
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

如果要使用本機 checkout：

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

日常 workflow 優先使用：

- `evercore_scope` - 解析目前 repo memory scope
- `evercore_briefing` - 產生 Markdown context briefing
- `evercore_remember` - 用 safety checks 寫入 durable project、user、agent memory
- `evercore_recall` - 取回 normalized memory snippets
- `evercore_forget` - 刪除明確 memory 或已確認的測試 scope
- `evercore_ingest_codex` - 建立或寫入 Codex rollout summary；預設 dry-run
- `evercore_list_spaces` - 列出 current/configured memory spaces
- `evercore_fetch_history` - 取得有限 scoped memory history
- `evercore_ingest_status` - 檢查 Codex transcript source hash 是否存在
- `evercore_request_status` - 從 search evidence 推估有限 request/source status

低階相容工具：

- `evercore_health`
- `evercore_search`
- `evercore_add`
- `evercore_flush`
- `evercore_delete`

## CLI

如果是從 checkout 執行，也可以使用 npm scripts：

```bash
npm run scope
npm run briefing
npm run spaces
npm run history -- --scope project --memory-types raw_message,episodic_memory --query "recent decisions"
npm run ingest:codex -- --latest --dry-run
npm run ingest:status -- --latest
```

`ingest:codex` 會讀取 `~/.codex/sessions/**/rollout-*.jsonl`，摘要有價值的 session context，redact 常見 secret patterns，並可寫入 project/agent memory 到 EverCore。

## Project Isolation

Project memory 會透過 EverCore `group_id` 隔離。預設會從目前 Git remote 推導穩定 group，例如：

```text
coding:github:example-org/example-repo
```

也可以用環境變數覆蓋或補充 scope：

```bash
export EVERCORE_DEFAULT_GROUP_ID="coding:my-project"
export EVERCORE_DEFAULT_SESSION_ID="my-project"
```

## Safety

高階寫入路徑包含保守的 sensitive-content guard，會攔截常見 secrets，例如 API keys、bearer tokens、passwords、cookies、private keys、`.env` dumps。

請把 memory 當成長期 operational context：適合存決策、慣例、已驗證修復與穩定偏好；避免存 raw secrets 或短暫 logs。

## 建議的 Agent Prompts

將以下內容加入你的 agent 指令檔（例如 `AGENTS.md`、`copilot-instructions.md` 或 workspace guidelines），讓 agent 主動使用 EverCore memory：

```markdown
## EverCore Memory

此 workspace 使用自託管的 EverCore memory 後端來維持跨對話的持久化上下文。EverCore MCP 工具（`evercore_*`）在每次對話中皆可用。

### 對話開始時

- 每次對話開始時，呼叫 `evercore_briefing` 取得目前 repo scope 的記憶簡報。
- 若無 briefing 工具可用，使用 `evercore_recall` 搭配 `scope: "project"` 檢查與目前 repo 相關的過往決策、偏好或慣例。

### 對話進行中

- 在對使用者偏好、專案慣例或過往決策做出假設之前，先用 `evercore_recall` 搜尋記憶。
- 將取回的記憶視為輔助上下文，而非證據。若記憶與實際檔案或服務衝突，以實際來源為準並記錄差異。

### 有用互動後

當資訊具備持久性且未來可能有用時，使用 `evercore_remember` 寫入記憶：

- 使用者偏好或長期指示
- 穩定的專案決策或架構選擇
- 已驗證的服務端點、運作事實或設定值
- 解釋根本原因的 debug 發現
- 可重複使用的命令或工作流程

不要儲存：暫時性輸出、推測性分析或低價值的對話填充內容。

### 隱私

絕不儲存 secrets：`.env` 值、API keys、tokens、密碼、私鑰或個人識別資訊。涉及敏感上下文時，只摘要安全的持久事實。
```

## Compatibility Notes

不同 EverCore-compatible runtime 的 group listing 行為可能不同。如果 remote group listing 不可用，`evercore_list_spaces` 仍會回傳 current/config-derived spaces，並在 response 中標明限制。

Raw message history 會使用 search fallback，因為部分 EverCore runtime 的 `/api/v1/memories/get` 只支援 extracted memory types。

## Maintainer Checks

```bash
npm run test
npm run tools
npm pack --dry-run
```

Networked smoke tests 需要明確指定 EverCore endpoint：

```bash
EVERCORE_BASE_URL="http://localhost:1995" npm run smoke
EVERCORE_BASE_URL="http://localhost:1995" npm run high-level-tools
```
