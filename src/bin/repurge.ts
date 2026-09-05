#!/usr/bin/env node
import { createProgram } from '../cli/index.js';

const program = createProgram();

program.parseAsync(process.argv).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  if (process.env.REPURGE_VERBOSE) {
    console.error(error);
  }
  process.exitCode = 1;
});
