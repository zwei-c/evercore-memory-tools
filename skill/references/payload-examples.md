# EverCore Payload Examples

Assume:

```bash
export EVERCORE_BASE_URL="https://evercore.example.com"
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
    "user_id": "wei",
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
    "query": "What response language does wei prefer?",
    "method": "hybrid",
    "memory_types": ["episodic_memory", "profile"],
    "filters": {
      "user_id": "wei"
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
      "user_id": "wei",
      "session_id": "example-session"
    },
    "top_k": 5
  }'
```

## Flush

```bash
curl -sS "$EVERCORE_API_BASE_URL/memories/flush" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "wei",
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
    "query": "What did wei decide about EverCore?",
    "method": "hybrid",
    "memory_types": ["episodic_memory", "profile"],
    "filters": {
      "user_id": "wei"
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
    "user_id": "wei",
    "session_id": "evercore-mcp-setup-20260601",
    "messages": [
      {
        "role": "user",
        "content": "The EverCore self-hosted instance is restricted to internal IPs."
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
    "user_id": "wei",
    "session_id": "evercore-mcp-setup-20260601"
  }
}
```

