const SENSITIVE_PATTERNS = [
  {
    name: "secret_assignment",
    pattern: /[A-Za-z_][A-Za-z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASS|COOKIE)[A-Za-z0-9_]*\s*[:=]\s*["']?[^\s"'`]+/gi
  },
  {
    name: "bearer_token",
    pattern: /Authorization\s*:\s*Bearer\s+[A-Za-z0-9._~+/=-]+/gi
  },
  {
    name: "private_key",
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g
  },
  {
    name: "common_token",
    pattern: /(?:sk|pk|rk)-[A-Za-z0-9_-]{16,}/g
  }
];

export function detectSensitiveText(value) {
  const text = String(value ?? "");
  const findings = [];

  for (const { name, pattern } of SENSITIVE_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) {
      findings.push({ name, confidence: "high" });
    }
  }

  return findings;
}

export function assertSafeToStore(value) {
  const findings = detectSensitiveText(value);
  if (findings.length > 0) {
    throw new Error(`Refusing to store likely sensitive content: ${findings.map((item) => item.name).join(", ")}`);
  }
}

export function redactSensitiveText(value) {
  let text = String(value ?? "");

  text = text.replace(
    /([A-Za-z_][A-Za-z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASS|COOKIE)[A-Za-z0-9_]*\s*[:=]\s*)(["']?)[^\s"'`]+/gi,
    "$1$2[REDACTED]"
  );
  text = text.replace(/(Authorization\s*:\s*Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, "$1[REDACTED]");
  text = text.replace(
    /(-----BEGIN [A-Z ]*PRIVATE KEY-----)[\s\S]*?(-----END [A-Z ]*PRIVATE KEY-----)/g,
    "$1[REDACTED]$2"
  );
  text = text.replace(/(?:sk|pk|rk)-[A-Za-z0-9_-]{16,}/g, "[REDACTED]");

  return text;
}

