#!/usr/bin/env bun
import { run } from "./cli/app";
import { printCliError } from "./errors";

run().catch((err) => {
  printCliError(err);
  process.exit(1);
});
