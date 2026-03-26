import { readFile } from "node:fs/promises";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { type Command, InvalidArgumentError } from "commander";
import { CliError } from "../errors";

export function parsePositiveInt(name: string): (value: string) => number {
  return (value: string): number => {
    const n = Number.parseInt(value, 10);
    if (!Number.isInteger(n) || n < 1) {
      throw new InvalidArgumentError(`${name} must be a positive integer.`);
    }
    return n;
  };
}

export function parseNonNegativeInt(name: string): (value: string) => number {
  return (value: string): number => {
    const n = Number.parseInt(value, 10);
    if (!Number.isInteger(n) || n < 0) {
      throw new InvalidArgumentError(`${name} must be a non-negative integer.`);
    }
    return n;
  };
}

export function parsePriority(value: string): number {
  const n = Number.parseInt(value, 10);
  if (!Number.isInteger(n) || n < 0 || n > 4) {
    throw new InvalidArgumentError("priority must be an integer from 0 to 4.");
  }
  return n;
}

export function strict(command: Command): Command {
  return command.allowUnknownOption(false).allowExcessArguments(false);
}

export function addWorkspaceOption(command: Command): Command {
  return command.option(
    "-w, --workspace <name>",
    "Use a specific workspace profile",
  );
}

export function addDangerOptions(command: Command): Command {
  return command
    .option("--dry-run", "Preview action without applying changes")
    .option("-y, --yes", "Skip confirmation prompt");
}

export async function ensureConfirmed(options: {
  yes?: boolean;
  prompt: string;
  invocation: string;
}): Promise<void> {
  if (options.yes) return;

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new CliError("Confirmation required in non-interactive mode.", {
      suggestion: `Re-run with --yes. Example: ${options.invocation} --yes`,
    });
  }

  const rl = createInterface({ input: stdin, output: stdout });
  const answer = (await rl.question(`${options.prompt} [y/N] `)).trim();
  rl.close();

  if (!["y", "yes"].includes(answer.toLowerCase())) {
    throw new CliError("Aborted.");
  }
}

export function printDryRun(payload: Record<string, unknown>): void {
  console.log(JSON.stringify({ dryRun: true, ...payload }, null, 2));
}

export async function guardDangerousAction(options: {
  yes?: boolean;
  dryRun?: boolean;
  action: string;
  target: string;
  invocation: string;
}): Promise<boolean> {
  if (options.dryRun) {
    printDryRun({ action: options.action, target: options.target });
    return false;
  }

  await ensureConfirmed({
    yes: options.yes,
    prompt: `${options.action} ${options.target}?`,
    invocation: options.invocation,
  });

  return true;
}

export interface ResolveTextInputOptions {
  value?: string;
  file?: string;
  valueFlag: string;
  fileFlag: string;
  required?: boolean;
  stdin?: { consumed: boolean };
}

export function addCommandExamples(
  command: Command,
  examples: string[],
): Command {
  const lines = examples.map((example) => `  ${example}`).join("\n");
  return command.addHelpText("after", `\nExamples:\n${lines}`);
}

export async function resolveTextInput(
  options: ResolveTextInputOptions,
): Promise<string | undefined> {
  const { value, file, valueFlag, fileFlag, required = false, stdin } = options;

  if (value !== undefined && file !== undefined) {
    throw new CliError(
      `Flags ${valueFlag} and ${fileFlag} are mutually exclusive.`,
    );
  }

  if (file !== undefined) {
    if (file === "-") {
      if (stdin?.consumed) {
        throw new CliError(
          "Standard input was already consumed by another flag.",
          {
            suggestion: `Use a file path for either ${valueFlag} or ${fileFlag} instead of '-' when both are needed.`,
          },
        );
      }
      if (stdin) {
        stdin.consumed = true;
      }
      return await Bun.stdin.text();
    }

    try {
      return await readFile(file, "utf8");
    } catch (error) {
      throw new CliError(`Failed to read file: ${file}`, {
        cause: error,
        suggestion: "Check the file path and permissions.",
      });
    }
  }

  if (required && value === undefined) {
    throw new CliError(`One of ${valueFlag} or ${fileFlag} is required.`);
  }

  return value;
}
