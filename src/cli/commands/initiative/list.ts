import type { Command } from "commander";
import {
  type ListInitiativesOptions,
  listInitiatives,
} from "../../../commands/initiative";
import { addWorkspaceOption, parsePositiveInt, strict } from "../../helpers";

export function registerInitiativeList(parent: Command): void {
  strict(addWorkspaceOption(parent.command("list")))
    .description("List initiatives")
    .option("--limit <n>", "Maximum results", parsePositiveInt("limit"))
    .option("--json", "Output as JSON")
    .action(async (options) => {
      const opts: ListInitiativesOptions = {
        limit: options.limit,
        json: options.json,
      };
      await listInitiatives(opts);
    });
}
