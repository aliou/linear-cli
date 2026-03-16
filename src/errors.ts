export class CliError extends Error {
  readonly suggestion?: string;

  constructor(
    message: string,
    options?: { suggestion?: string; cause?: unknown },
  ) {
    super(message, { cause: options?.cause });
    this.name = "CliError";
    this.suggestion = options?.suggestion;
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
