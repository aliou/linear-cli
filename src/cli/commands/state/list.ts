import type { Command } from "commander";
import { type ListStatesOptions, listStates } from "../../../commands/state";
import { addWorkspaceOption, parsePositiveInt, strict } from "../../helpers";

export function registerStateList(parent: Command): void {
  strict(addWorkspaceOption(parent.command("list")))
    .description("List workflow states")
    .option("--team <key>", "Filter by team key")
    .option("--limit <n>", "Maximum results", parsePositiveInt("limit"))
    .option("--json", "Output as JSON")
    .action(async (options) => {
      const opts: ListStatesOptions = {
        team: options.team,
        limit: options.limit,
        json: options.json,
      };
      await listStates(opts);
    });
}
