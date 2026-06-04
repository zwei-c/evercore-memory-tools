#!/usr/bin/env node

const BASE_URL = (process.env.EVERCORE_BASE_URL || "http://localhost:1995").replace(/\/+$/, "");
const API_BASE_URL = `${BASE_URL}/api/v1`;
const API_KEY = process.env.EVERCORE_API_KEY || "";
const userId = process.env.EVERCORE_SMOKE_USER_ID || "codex-smoke-user";
const sessionId = process.env.EVERCORE_SMOKE_SESSION_ID || `codex-smoke-${Date.now()}`;
const groupId = process.env.EVERCORE_SMOKE_GROUP_ID || `coding:smoke:${sessionId}`;

const headers = {
  Accept: "application/json",
  "Content-Type": "application/json"
};

if (API_KEY) {
  headers.Authorization = `Bearer ${API_KEY}`;
}

console.log(`EverCore smoke test`);
console.log(`Base URL: ${BASE_URL}`);
console.log(`User ID: ${userId}`);
console.log(`Session ID: ${sessionId}`);
console.log(`Group ID: ${groupId}`);

await step("health", async () => {
  const result = await request(`${BASE_URL}/health`, { method: "GET", body: undefined });
  assert(result.status === "healthy", "health status should be healthy");
  return result;
});

await step("add personal messages", async () => {
  return request(`${API_BASE_URL}/memories`, {
    method: "POST",
    body: {
      user_id: userId,
      session_id: sessionId,
      messages: [
        {
          role: "user",
          timestamp: Date.now(),
          content: "Codex smoke test: the favorite test beverage is unsweetened black coffee."
        },
        {
          role: "assistant",
          timestamp: Date.now() + 1000,
          content: "Recorded the smoke-test preference for later retrieval."
        }
      ]
    }
  });
});

await step("search raw messages", async () => {
  const result = await request(`${API_BASE_URL}/memories/search`, {
    method: "POST",
    body: {
      query: "favorite test beverage unsweetened black coffee",
      method: "keyword",
      memory_types: ["raw_message"],
      filters: {
        user_id: userId,
        session_id: sessionId
      },
      top_k: 5
    }
  });
  assert(result.data?.raw_messages?.length > 0, "raw search should return at least one message");
  return summarizeSearch(result);
});

await step("flush", async () => {
  return request(`${API_BASE_URL}/memories/flush`, {
    method: "POST",
    body: {
      user_id: userId,
      session_id: sessionId
    }
  });
});

await step("search extracted memories", async () => {
  const result = await request(`${API_BASE_URL}/memories/search`, {
    method: "POST",
    body: {
      query: "what beverage does the smoke test prefer?",
      method: "hybrid",
      memory_types: ["episodic_memory", "profile"],
      filters: {
        user_id: userId
      },
      top_k: 5
    }
  });
  assert(
    result.data?.episodes?.length > 0 || result.data?.profiles?.length > 0,
    "extracted search should return an episode or profile"
  );
  return summarizeSearch(result);
});

await step("delete smoke data", async () => {
  return request(`${API_BASE_URL}/memories/delete`, {
    method: "POST",
    expectNoContent: true,
    body: {
      user_id: userId,
      session_id: sessionId
    }
  });
});

await step("add group messages", async () => {
  return request(`${API_BASE_URL}/memories/group`, {
    method: "POST",
    body: {
      group_id: groupId,
      group_meta: {
        source: "evercore-memory-tools-smoke"
      },
      messages: [
        {
          role: "user",
          timestamp: Date.now(),
          sender_id: "codex-smoke",
          sender_name: "Codex Smoke",
          content: "EverCore group smoke test: repo-scoped memory stores the alpha release checklist."
        },
        {
          role: "assistant",
          timestamp: Date.now() + 1000,
          sender_id: "codex-smoke",
          sender_name: "Codex Smoke",
          content: "Recorded the repo-scoped alpha release checklist."
        }
      ]
    }
  });
});

await step("search group raw messages", async () => {
  const result = await request(`${API_BASE_URL}/memories/search`, {
    method: "POST",
    body: {
      query: "repo-scoped memory alpha release checklist",
      method: "keyword",
      memory_types: ["raw_message"],
      filters: {
        group_id: groupId
      },
      top_k: 5
    }
  });
  assert(result.data?.raw_messages?.length > 0, "group raw search should return at least one message");
  return summarizeSearch(result);
});

await step("flush group memories", async () => {
  return request(`${API_BASE_URL}/memories/group/flush`, {
    method: "POST",
    body: {
      group_id: groupId
    }
  });
});

await step("delete group smoke data", async () => {
  return request(`${API_BASE_URL}/memories/delete`, {
    method: "POST",
    expectNoContent: true,
    body: {
      group_id: groupId
    }
  });
});

await step("add agent trajectory messages", async () => {
  return request(`${API_BASE_URL}/memories/agent`, {
    method: "POST",
    body: {
      user_id: userId,
      session_id: `${sessionId}-agent`,
      messages: [
        {
          role: "user",
          timestamp: Date.now(),
          content: "EverCore agent smoke test: inspect the failing deployment check."
        },
        {
          role: "assistant",
          timestamp: Date.now() + 1000,
          content: "The deployment check failed because the smoke test intentionally used a placeholder."
        }
      ]
    }
  });
});

await step("flush agent memories", async () => {
  return request(`${API_BASE_URL}/memories/agent/flush`, {
    method: "POST",
    body: {
      user_id: userId,
      session_id: `${sessionId}-agent`
    }
  });
});

await step("delete agent smoke data", async () => {
  return request(`${API_BASE_URL}/memories/delete`, {
    method: "POST",
    expectNoContent: true,
    body: {
      user_id: userId,
      session_id: `${sessionId}-agent`
    }
  });
});

console.log("Smoke test passed.");

async function step(name, callback) {
  process.stdout.write(`- ${name}... `);
  const result = await callback();
  console.log("ok");
  if (process.env.VERBOSE) {
    console.log(JSON.stringify(result, null, 2));
  }
}

async function request(url, options) {
  const response = await fetch(url, {
    method: options.method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });

  if (options.expectNoContent && response.status === 204) {
    return { ok: true, status: 204 };
  }

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(`${options.method} ${url} failed with ${response.status}: ${JSON.stringify(data)}`);
  }

  return data;
}

function summarizeSearch(result) {
  return {
    episodes: result.data?.episodes?.length || 0,
    profiles: result.data?.profiles?.length || 0,
    raw_messages: result.data?.raw_messages?.length || 0
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
