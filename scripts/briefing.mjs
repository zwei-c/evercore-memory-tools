#!/usr/bin/env node

import { buildBriefing } from "../src/briefing.mjs";
import { parseArgs } from "../src/utils.mjs";

const args = parseArgs(process.argv.slice(2));
const briefing = await buildBriefing(args);
console.log(briefing.markdown);

