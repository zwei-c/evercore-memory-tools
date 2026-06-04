import { execFileSync } from "node:child_process";
import path from "node:path";

export function resolveScope(cwd = process.cwd()) {
  const repoRoot = git(["rev-parse", "--show-toplevel"], cwd);
  const resolvedCwd = path.resolve(cwd);
  const root = repoRoot || resolvedCwd;
  const remote = repoRoot ? git(["remote", "get-url", "origin"], root) : "";
  const remoteScope = remote ? scopeFromRemote(remote) : "";
  const repoScope = remoteScope || `local:${path.basename(root)}`;

  return {
    cwd: resolvedCwd,
    repo_root: root,
    remote: remote || null,
    repo_scope: repoScope,
    space_id: `coding:${repoScope}`,
    group_id: `coding:${repoScope}`
  };
}

export function scopeFromRemote(remote) {
  const normalized = remote.trim().replace(/\.git$/, "");
  const scpLike = normalized.match(/^git@([^:]+):(.+)$/);
  if (scpLike) {
    return `${providerFromHost(scpLike[1])}:${scpLike[2]}`;
  }

  let url;
  try {
    url = new URL(normalized);
  } catch {
    return `git:${sanitizeScope(normalized)}`;
  }

  return `${providerFromHost(url.hostname)}:${url.pathname.replace(/^\/+/, "")}`;
}

function providerFromHost(host) {
  const normalized = host.toLowerCase();
  if (normalized.includes("github")) return "github";
  if (normalized.includes("gitlab")) return "gitlab";
  return normalized.replace(/[^a-z0-9.-]+/g, "-");
}

function sanitizeScope(value) {
  return value.replace(/^[/:]+|[/:]+$/g, "").replace(/[^A-Za-z0-9._/-]+/g, "-");
}

function git(args, cwd) {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {
    return "";
  }
}

