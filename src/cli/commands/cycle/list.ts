import type { Command } from "commander";
import { type ListCyclesOptions, listCycles } from "../../../commands/cycle";
import { addWorkspaceOption, parsePositiveInt, strict } from "../../helpers";

export function registerCycleList(parent: Command): void {
  strict(addWorkspaceOption(parent.command("list")))
    .description("List cycles")
    .option("--team <key>", "Filter by team key")
    .option("--limit <n>", "Maximum results", parsePositiveInt("limit"))
    .option("--json", "Output as JSON")
    .action(async (options) => {
      const opts: ListCyclesOptions = {
        team: options.team,
        limit: options.limit,
        json: options.json,
      };
      await listCycles(opts);
    });
}
