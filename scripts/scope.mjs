#!/usr/bin/env node

import { resolveScope } from "../src/scope.mjs";

const cwd = readOption("--cwd") || process.cwd();
console.log(JSON.stringify(resolveScope(cwd), null, 2));

function readOption(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return "";
  return process.argv[index + 1] || "";
}

