#!/usr/bin/env node

import { getEverCoreConfig } from "../src/config.mjs";
import { EverCoreClient } from "../src/http.mjs";
import { listKnownSpaces } from "../src/spaces.mjs";
import { parseArgs } from "../src/utils.mjs";

const args = parseArgs(process.argv.slice(2));
const result = await listKnownSpaces(normalizeArgs(args), new EverCoreClient(getEverCoreConfig()));

console.log(JSON.stringify(result, null, 2));

function normalizeArgs(args) {
  return {
    ...args,
    include_remote: parseBoolean(args.includeRemote ?? args.include_remote, true),
    include_config: parseBoolean(args.includeConfig ?? args.include_config, true),
    include_current: parseBoolean(args.includeCurrent ?? args.include_current, true)
  };
}

function parseBoolean(value, fallback) {
  if (value === undefined) return fallback;
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return fallback;
}
