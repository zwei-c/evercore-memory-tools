#!/usr/bin/env node

import { getEverCoreConfig } from "../src/config.mjs";
import { fetchHistory } from "../src/history.mjs";
import { EverCoreClient } from "../src/http.mjs";
import { parseArgs } from "../src/utils.mjs";

const args = parseArgs(process.argv.slice(2));
const config = getEverCoreConfig();
const result = await fetchHistory(normalizeArgs(args), new EverCoreClient(config), config);

console.log(JSON.stringify(result, null, 2));

function normalizeArgs(args) {
  return {
    ...args,
    memory_types: normalizeList(args.memoryTypes ?? args.memory_types),
    page: args.page === undefined ? undefined : Number(args.page),
    page_size: (args.pageSize ?? args.page_size) === undefined ? undefined : Number(args.pageSize ?? args.page_size),
    include_raw_result: parseBoolean(args.includeRawResult ?? args.include_raw_result, false)
  };
}

function normalizeList(value) {
  if (!value) return undefined;
  if (Array.isArray(value)) return value;
  return String(value).split(",").map((item) => item.trim()).filter(Boolean);
}

function parseBoolean(value, fallback) {
  if (value === undefined) return fallback;
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return fallback;
}
