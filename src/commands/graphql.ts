import { graphqlRequest } from "../api.ts";
import { CliError } from "../errors.ts";
import { requireToken } from "./shared.ts";

export interface RunGraphqlOptions {
  query?: string;
  variables?: string;
}

export async function runGraphql(options: RunGraphqlOptions): Promise<void> {
  const query = await readQuery(options.query);
  if (!query) {
    throw new CliError("A GraphQL query or mutation is required.", {
      suggestion:
        "Pass it as a string argument, or pipe it to 'linear graphql' via stdin.",
    });
  }

  const variables = parseVariables(options.variables);
  const token = await requireToken();
  const result = await graphqlRequest(token, query, variables);

  if (result.errors?.length) {
    throw new CliError(result.errors.map((error) => error.message).join(", "));
  }

  console.log(JSON.stringify(result.data ?? null, null, 2));
}

export function parseVariables(
  raw: string | undefined,
): Record<string, unknown> | undefined {
  if (!raw) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new CliError("GraphQL variables must be a JSON object.", {
        suggestion: 'Pass an object like --variables \'{"id":"ENG-123"}\'.',
      });
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof CliError) {
      throw error;
    }

    throw new CliError("Invalid JSON passed to --variables.", {
      suggestion: 'Pass an object like --variables \'{"id":"ENG-123"}\'.',
      cause: error,
    });
  }
}

async function readQuery(queryFromArgs?: string): Promise<string | undefined> {
  if (queryFromArgs) {
    return queryFromArgs.trim() || undefined;
  }

  if (process.stdin.isTTY) {
    return undefined;
  }

  const input = (await Bun.stdin.text()).trim();
  return input || undefined;
}
