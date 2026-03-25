import type { Command } from "commander";
import {
  type DeleteMilestoneOptions,
  deleteMilestone,
} from "../../../commands/milestone";
import { addWorkspaceOption, strict } from "../../helpers";

export function registerMilestoneDelete(parent: Command): void {
  strict(addWorkspaceOption(parent.command("delete")))
    .description("Delete milestone")
    .argument("<id>")
    .option("--json", "Output as JSON")
    .action(async (id: string, options) => {
      const opts: DeleteMilestoneOptions = {
        id,
        json: options.json,
      };
      await deleteMilestone(opts);
    });
}
