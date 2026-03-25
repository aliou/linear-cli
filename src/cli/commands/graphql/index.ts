import type { Command } from "commander";
import { type RunGraphqlOptions, runGraphql } from "../../../commands/graphql";
import { addWorkspaceOption, resolveTextInput, strict } from "../../helpers";

export function registerGraphql(program: Command): void {
  strict(addWorkspaceOption(program.command("graphql")))
    .description("Run arbitrary GraphQL")
    .argument("[query...]", "GraphQL query/mutation string")
    .option("--query-file <file>", "Read GraphQL query/mutation from file")
    .option("--variables <json>", "Variables object as JSON")
    .option("--variables-file <file>", "Read variables JSON from file")
    .action(async (queryParts: string[] | undefined, options) => {
      const stdin = { consumed: false };
      const queryFromArgs =
        Array.isArray(queryParts) && queryParts.length > 0
          ? queryParts.join(" ")
          : undefined;
      const query = await resolveTextInput({
        value: queryFromArgs,
        file: options.queryFile,
        valueFlag: "query argument",
        fileFlag: "--query-file",
        stdin,
      });
      const variables = await resolveTextInput({
        value: options.variables,
        file: options.variablesFile,
        valueFlag: "--variables",
        fileFlag: "--variables-file",
        stdin,
      });

      const opts: RunGraphqlOptions = {
        query,
        variables,
      };
      await runGraphql(opts);
    });
}
