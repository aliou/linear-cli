import type { Command } from "commander";
import { type ListTeamsOptions, listTeams } from "../../../commands/team";
import { addWorkspaceOption, parsePositiveInt, strict } from "../../helpers";

export function registerTeamList(parent: Command): void {
  strict(addWorkspaceOption(parent.command("list")))
    .description("List teams")
    .option("--limit <n>", "Maximum results", parsePositiveInt("limit"))
    .option("--json", "Output as JSON")
    .action(async (options) => {
      const opts: ListTeamsOptions = {
        limit: options.limit,
        json: options.json,
      };
      await listTeams(opts);
    });
}
