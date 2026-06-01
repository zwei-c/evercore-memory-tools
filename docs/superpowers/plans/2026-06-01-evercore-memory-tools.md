# EverCore Memory Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local MCP server and reusable skill for the self-hosted EverCore memory backend.

**Architecture:** Keep the MCP server as a dependency-free Node.js stdio JSON-RPC process that forwards validated tool calls to EverCore HTTP endpoints. Keep agent behavior in a separate skill so clients get both stable tools and consistent memory workflow guidance.

**Tech Stack:** Node.js 20+, built-in `fetch`, stdio JSON-RPC, EverCore HTTP API.

---

### Task 1: Project Skeleton

**Files:**
- Create: `evercore-memory-tools/package.json`
- Create: `evercore-memory-tools/README.md`
- Create: `evercore-memory-tools/docs/superpowers/plans/2026-06-01-evercore-memory-tools.md`

- [x] Create the directory structure under `/home/wei/workspace/evercore-memory-tools`.
- [x] Add package metadata with `npm run mcp`, `npm run smoke`, and `npm run tools`.
- [x] Document environment variables, tool names, and MCP client config.

### Task 2: MCP Server

**Files:**
- Create: `evercore-memory-tools/bin/evercore-memory-mcp.mjs`

- [x] Implement stdio JSON-RPC message parsing.
- [x] Support `initialize`, `tools/list`, and `tools/call`.
- [x] Forward health, search, add, flush, and delete calls to EverCore.
- [x] Return structured JSON content for successful and failed calls.

### Task 3: Skill

**Files:**
- Create: `evercore-memory-tools/skill/SKILL.md`
- Create: `evercore-memory-tools/skill/references/payload-examples.md`

- [x] Describe when the skill should trigger.
- [x] Define safe memory search/add/flush behavior.
- [x] Include privacy rules for secrets and sensitive data.
- [x] Include payload examples for direct EverCore calls and MCP tool use.

### Task 4: Verification Scripts

**Files:**
- Create: `evercore-memory-tools/scripts/smoke-test.mjs`
- Create: `evercore-memory-tools/scripts/list-tools.mjs`

- [x] Add an HTTP smoke test that performs health, add, raw search, flush, extracted search, and delete.
- [x] Add a local MCP smoke test that verifies `initialize`, `tools/list`, and `evercore_health` through `tools/call`.
- [x] Run both scripts from the new directory.
