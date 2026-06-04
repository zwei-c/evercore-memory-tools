# Changelog

## [0.1.1] - 2026-06-04

### Changed

- 重組 skill 目錄結構：`skill/` → `skills/evercore-memory/`，符合 `skills.sh` 格式
- 在 SKILL.md 加入 `license`、`author`、`homepage`、`source` metadata

### Added

- README 新增「建議的 Agent Prompts」章節（中/英文）
- README 新增 Skills Installation 說明（`npx skills add zwei-c/evercore-memory-tools`）

## [0.1.0] - 2026-06-03

### Added

- MCP server (`bin/evercore-memory-mcp.mjs`) 支援 EverCore memory workflow
- 高階工具：`evercore_scope`、`evercore_briefing`、`evercore_remember`、`evercore_recall`、`evercore_forget`、`evercore_ingest_codex`、`evercore_list_spaces`、`evercore_fetch_history`、`evercore_ingest_status`
- 低階工具：`evercore_health`、`evercore_search`、`evercore_add`、`evercore_flush`、`evercore_delete`
- CLI scripts：`scope`、`briefing`、`spaces`、`history`、`ingest:codex`、`ingest:status`
- Codex rollout transcript ingestion（`scripts/ingest-codex-session.mjs`）
- Sensitive-content safety guard
- Project isolation 透過 EverCore `group_id`
- npm package 發布為 `@zwei-c/evercore-memory-tools`
