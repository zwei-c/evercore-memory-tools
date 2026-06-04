#!/usr/bin/env node

import { getCodexIngestStatus } from "../src/codex-ingest.mjs";
import { getEverCoreConfig } from "../src/config.mjs";
import { EverCoreClient } from "../src/http.mjs";
import { parseArgs } from "../src/utils.mjs";

const args = parseArgs(process.argv.slice(2));
if (!args.sourceHash && !args.source_hash && !args.latest && !args.file) {
  throw new Error("Usage: npm run ingest:status -- --source-hash <hash> --group-id <group> OR --latest OR --file /path/to/rollout.jsonl");
}

const result = await getCodexIngestStatus({
  ...args,
  latest: args.latest ?? (!args.file && !args.sourceHash && !args.source_hash)
}, new EverCoreClient(getEverCoreConfig()));

console.log(JSON.stringify(result, null, 2));
