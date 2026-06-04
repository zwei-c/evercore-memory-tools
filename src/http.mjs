import { getEverCoreConfig } from "./config.mjs";

export class EverCoreClient {
  constructor(config = getEverCoreConfig()) {
    this.config = config;
  }

  async request(path, options = {}) {
    const method = options.method || "GET";
    const url = `${options.apiPrefix === false ? this.config.baseUrl : this.config.apiBaseUrl}${path}`;
    const headers = {
      Accept: "application/json"
    };

    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    if (this.config.apiKey) {
      headers.Authorization = `Bearer ${this.config.apiKey}`;
    }

    const response = await fetch(url, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });

    if (options.expectNoContent && response.status === 204) {
      return { status: 204, ok: true };
    }

    const text = await response.text();
    let data = null;

    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { text };
      }
    }

    if (!response.ok) {
      throw new Error(`EverCore ${method} ${path} failed with HTTP ${response.status}: ${JSON.stringify(data)}`);
    }

    return data;
  }

  health() {
    return this.request("/health", { apiPrefix: false });
  }

  search(payload) {
    return this.request("/memories/search", {
      method: "POST",
      body: payload
    });
  }

  add(payload) {
    return this.request("/memories", {
      method: "POST",
      body: payload
    });
  }

  flush(payload) {
    return this.request("/memories/flush", {
      method: "POST",
      body: payload
    });
  }

  delete(payload) {
    return this.request("/memories/delete", {
      method: "POST",
      body: payload,
      expectNoContent: true
    });
  }

  getMemories(payload) {
    return this.request("/memories/get", {
      method: "POST",
      body: payload
    });
  }

  rememberGroup(payload) {
    return this.request("/memories/group", {
      method: "POST",
      body: payload
    });
  }

  flushGroup(payload) {
    return this.request("/memories/group/flush", {
      method: "POST",
      body: payload
    });
  }

  rememberAgent(payload) {
    return this.request("/memories/agent", {
      method: "POST",
      body: payload
    });
  }

  flushAgent(payload) {
    return this.request("/memories/agent/flush", {
      method: "POST",
      body: payload
    });
  }

  listGroups() {
    return this.request("/groups");
  }
}
