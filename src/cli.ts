#!/usr/bin/env node
import { PromptCancelledError } from '@trut/gen';
import { runCli } from './cli/run';

runCli(process.argv.slice(2)).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`\n${message}\n`);
  process.exitCode = error instanceof PromptCancelledError ? 130 : 1;
});
