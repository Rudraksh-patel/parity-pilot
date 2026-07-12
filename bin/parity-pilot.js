#!/usr/bin/env node

import { runCli } from '../dist/index.js';

runCli().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
