import type { Command } from "commander";
import {
  type DeleteMilestoneOptions,
  deleteMilestone,
} from "../../../commands/milestone";
import {
  addDangerOptions,
  addWorkspaceOption,
  guardDangerousAction,
  strict,
} from "../../helpers";

export function registerMilestoneDelete(parent: Command): void {
  strict(addDangerOptions(addWorkspaceOption(parent.command("delete"))))
    .description("Delete milestone")
    .argument("<id>")
    .option("--json", "Output as JSON")
    .action(async (id: string, options) => {
      const shouldRun = await guardDangerousAction({
        yes: options.yes,
        dryRun: options.dryRun,
        action: "Delete milestone",
        target: id,
        invocation: `linear milestone delete ${id}`,
      });
      if (!shouldRun) return;

      const opts: DeleteMilestoneOptions = { id, json: options.json };
      await deleteMilestone(opts);
    });
}
