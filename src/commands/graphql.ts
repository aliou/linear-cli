import { graphqlRequest } from "../api.ts";
import { getString, parseArgs, wantsHelp } from "../args.ts";
import { CliError } from "../errors.ts";
import { requireToken } from "./shared.ts";

const GRAPHQL_OPTIONS = {
  variables: { type: "string" as const },
};

export async function runGraphql(args: string[]): Promise<void> {
  const parsed = parseArgs(args, GRAPHQL_OPTIONS);

  if (wantsHelp(parsed)) {
    printGraphqlHelp();
    return;
  }

  const query = await readQuery(parsed.positionals);
  if (!query) {
    throw new CliError("A GraphQL query or mutation is required.", {
      suggestion:
        "Pass it as a string argument, or pipe it to 'linear graphql' via stdin.",
    });
  }

  const variables = parseVariables(getString(parsed, "variables"));
  const token = await requireToken();
  const result = await graphqlRequest(token, query, variables);

  if (result.errors?.length) {
    throw new CliError(result.errors.map((error) => error.message).join(", "));
  }

  console.log(JSON.stringify(result.data ?? null, null, 2));
}

function printGraphqlHelp(): void {
  console.log(`
Usage: linear graphql [query] [--variables <json>]

Run an arbitrary GraphQL query or mutation against Linear.

Input:
  query               GraphQL query or mutation string
  stdin               If query is omitted, read the GraphQL document from stdin

Options:
  --variables <json>  Variables object as JSON
  -h, --help          Show this help

Examples:
  linear graphql 'query { viewer { id name email } }'
  linear graphql 'query Issue($id: String!) { issue(id: $id) { id title } }' \\
    --variables '{"id":"ENG-123"}'
  linear graphql 'mutation { issueUpdate(id: "...", input: {}) { success } }'
  echo 'query { viewer { id name } }' | linear graphql
`);
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

async function readQuery(positionals: string[]): Promise<string | undefined> {
  if (positionals.length > 0) {
    return positionals.join(" ").trim() || undefined;
  }

  if (process.stdin.isTTY) {
    return undefined;
  }

  const input = (await Bun.stdin.text()).trim();
  return input || undefined;
}
