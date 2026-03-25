import type { Command } from "commander";
import {
  type GetMilestoneOptions,
  getMilestone,
} from "../../../commands/milestone";
import { addWorkspaceOption, strict } from "../../helpers";

export function registerMilestoneGet(parent: Command): void {
  strict(addWorkspaceOption(parent.command("get")))
    .description("Get milestone")
    .argument("<id>")
    .option("--json", "Output as JSON")
    .action(async (id: string, options) => {
      const opts: GetMilestoneOptions = {
        id,
        json: options.json,
      };
      await getMilestone(opts);
    });
}
