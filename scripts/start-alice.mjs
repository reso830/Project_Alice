#!/usr/bin/env node
import process from 'node:process';
import { run, runServer } from './start-alice-core.mjs';

const entry = process.argv.includes('--serve') ? runServer : run;

entry().catch((error) => {
  console.error('[launcher]', error instanceof Error ? error.message : error);
  process.exit(1);
});
