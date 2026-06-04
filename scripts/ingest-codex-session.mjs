#!/usr/bin/env node

import { ingestCodexSession } from "../src/codex-ingest.mjs";
import { parseArgs } from "../src/utils.mjs";

const args = parseArgs(process.argv.slice(2));
if (!args.latest && !args.file) {
  throw new Error("Usage: npm run ingest:codex -- --latest OR --file /path/to/rollout.jsonl");
}

const result = await ingestCodexSession({
  ...args,
  dry_run: args.dryRun ?? args.dry_run ?? false
});

console.log(JSON.stringify(result, null, 2));

