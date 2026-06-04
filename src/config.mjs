const DEFAULT_BASE_URL = "http://localhost:1995";

export function getEverCoreConfig(env = process.env) {
  const baseUrl = (env.EVERCORE_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");

  return {
    baseUrl,
    apiBaseUrl: `${baseUrl}/api/v1`,
    apiKey: env.EVERCORE_API_KEY || "",
    defaultUserId: env.EVERCORE_DEFAULT_USER_ID || "",
    defaultSessionId: env.EVERCORE_DEFAULT_SESSION_ID || ""
  };
}

