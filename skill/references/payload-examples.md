# EverCore Payload Examples

Assume:

```bash
export EVERCORE_BASE_URL="http://localhost:1995"
export EVERCORE_API_BASE_URL="$EVERCORE_BASE_URL/api/v1"
```

## Health

```bash
curl -sS "$EVERCORE_BASE_URL/health"
```

## Add Personal Messages

```bash
curl -sS "$EVERCORE_API_BASE_URL/memories" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "developer",
    "session_id": "example-session",
    "messages": [
      {
        "role": "user",
        "timestamp": 1798646400000,
        "content": "I prefer concise Traditional Chinese responses."
      },
      {
        "role": "assistant",
        "timestamp": 1798646401000,
        "content": "Understood."
      }
    ]
  }'
```

## Search Extracted Memory

```bash
curl -sS "$EVERCORE_API_BASE_URL/memories/search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What response language does the developer prefer?",
    "method": "hybrid",
    "memory_types": ["episodic_memory", "profile"],
    "filters": {
      "user_id": "developer"
    },
    "top_k": 5
  }'
```

## Search Recent Raw Messages

```bash
curl -sS "$EVERCORE_API_BASE_URL/memories/search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "concise Traditional Chinese responses",
    "method": "keyword",
    "memory_types": ["raw_message"],
    "filters": {
      "user_id": "developer",
      "session_id": "example-session"
    },
    "top_k": 5
  }'
```

## Add Group Messages

Group messages require `sender_id` on each message in the current self-hosted EverCore runtime.

```bash
curl -sS "$EVERCORE_API_BASE_URL/memories/group" \
  -H "Content-Type: application/json" \
  -d '{
    "group_id": "coding:github:example-org/evercore-memory-tools",
    "group_meta": {
      "source": "codex"
    },
    "messages": [
      {
        "role": "user",
        "timestamp": 1798646400000,
        "sender_id": "codex",
        "sender_name": "Codex",
        "content": "Decision: use MCP-first high-level memory tools."
      }
    ]
  }'
```

## Flush Group Messages

```bash
curl -sS "$EVERCORE_API_BASE_URL/memories/group/flush" \
  -H "Content-Type: application/json" \
  -d '{
    "group_id": "coding:github:example-org/evercore-memory-tools"
  }'
```

## Add Agent Messages

```bash
curl -sS "$EVERCORE_API_BASE_URL/memories/agent" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "developer",
    "session_id": "codex-session",
    "messages": [
      {
        "role": "user",
        "timestamp": 1798646400000,
        "content": "Inspect the failing smoke test."
      },
      {
        "role": "assistant",
        "timestamp": 1798646401000,
        "content": "The smoke test failed because recall ran before raw indexing was visible."
      }
    ]
  }'
```

## Flush Agent Messages

```bash
curl -sS "$EVERCORE_API_BASE_URL/memories/agent/flush" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "developer",
    "session_id": "codex-session"
  }'
```

## Flush

```bash
curl -sS "$EVERCORE_API_BASE_URL/memories/flush" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "developer",
    "session_id": "example-session"
  }'
```

## Delete Test Data

```bash
curl -sS -X POST "$EVERCORE_API_BASE_URL/memories/delete" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "codex-smoke-user",
    "session_id": "codex-smoke-session"
  }'
```

## MCP Tool Call Shapes

Search:

```json
{
  "name": "evercore_search",
  "arguments": {
    "query": "What did the developer decide about EverCore?",
    "method": "hybrid",
    "memory_types": ["episodic_memory", "profile"],
    "filters": {
      "user_id": "developer"
    },
    "top_k": 5
  }
}
```

Add:

```json
{
  "name": "evercore_add",
  "arguments": {
    "user_id": "developer",
    "session_id": "evercore-mcp-setup-20260601",
    "messages": [
      {
        "role": "user",
        "content": "The self-hosted EverCore instance is available through the configured internal endpoint."
      }
    ]
  }
}
```

Flush:

```json
{
  "name": "evercore_flush",
  "arguments": {
    "user_id": "developer",
    "session_id": "evercore-mcp-setup-20260601"
  }
}
```

High-level recall:

```json
{
  "name": "evercore_recall",
  "arguments": {
    "query": "What did we decide about transcript ingestion?",
    "scope": "project",
    "categories": ["decision"],
    "include_raw": false,
    "top_k": 5
  }
}
```

High-level remember:

```json
{
  "name": "evercore_remember",
  "arguments": {
    "content": "Decision: Codex ingestion defaults to dry-run in MCP.",
    "scope": "project",
    "category": "decision",
    "flush": true
  }
}
```

High-level Codex ingest dry-run:

```json
{
  "name": "evercore_ingest_codex",
  "arguments": {
    "latest": true,
    "dry_run": true
  }
}
```

List spaces:

```json
{
  "name": "evercore_list_spaces",
  "arguments": {
    "include_remote": true
  }
}
```

Fetch scoped history:

```json
{
  "name": "evercore_fetch_history",
  "arguments": {
    "scope": "project",
    "memory_types": ["raw_message", "episodic_memory"],
    "query": "transcript ingestion",
    "page_size": 10
  }
}
```

Check Codex ingest status:

```json
{
  "name": "evercore_ingest_status",
  "arguments": {
    "latest": true
  }
}
```

Infer request/source status:

```json
{
  "name": "evercore_request_status",
  "arguments": {
    "source_hash": "abc123",
    "group_id": "coding:github:example-org/evercore-memory-tools"
  }
}
```
