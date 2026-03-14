export class CliError extends Error {
  readonly suggestion?: string;
  readonly cause?: unknown;

  constructor(
    message: string,
    options?: { suggestion?: string; cause?: unknown },
  ) {
    super(message);
    this.name = "CliError";
    this.suggestion = options?.suggestion;
    this.cause = options?.cause;
  }
}

export function toCliError(error: unknown): CliError {
  if (error instanceof CliError) {
    return error;
  }

  if (error instanceof Error) {
    return new CliError(error.message, { cause: error });
  }

  return new CliError(String(error));
}

export function printCliError(error: unknown): void {
  const cliError = toCliError(error);

  console.error(`Error: ${cliError.message}`);

  if (cliError.suggestion) {
    console.error(`Hint: ${cliError.suggestion}`);
  }
}
