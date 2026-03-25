import type { Command } from "commander";
import { type ListLabelsOptions, listLabels } from "../../../commands/label";
import { addWorkspaceOption, parsePositiveInt, strict } from "../../helpers";

export function registerLabelList(parent: Command): void {
  strict(addWorkspaceOption(parent.command("list")))
    .description("List labels")
    .option("--team <key>", "Filter by team key")
    .option("--limit <n>", "Maximum results", parsePositiveInt("limit"))
    .option("--json", "Output as JSON")
    .action(async (options) => {
      const opts: ListLabelsOptions = {
        team: options.team,
        limit: options.limit,
        json: options.json,
      };
      await listLabels(opts);
    });
}
