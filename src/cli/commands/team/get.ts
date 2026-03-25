import type { Command } from "commander";
import { type GetTeamOptions, getTeam } from "../../../commands/team";
import { addWorkspaceOption, strict } from "../../helpers";

export function registerTeamGet(parent: Command): void {
  strict(addWorkspaceOption(parent.command("get")))
    .description("Get team by key or ID")
    .argument("<team-key-or-id>")
    .option("--json", "Output as JSON")
    .action(async (teamRef: string, options) => {
      const opts: GetTeamOptions = {
        teamRef,
        json: options.json,
      };
      await getTeam(opts);
    });
}
