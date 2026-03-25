import type { Command } from "commander";
import {
  type ListMilestonesOptions,
  listMilestones,
} from "../../../commands/milestone";
import { addWorkspaceOption, parsePositiveInt, strict } from "../../helpers";

export function registerMilestoneList(parent: Command): void {
  strict(addWorkspaceOption(parent.command("list")))
    .description("List milestones")
    .option("--project <id>", "Filter by project ID")
    .option("--limit <n>", "Maximum results", parsePositiveInt("limit"))
    .option("--json", "Output as JSON")
    .action(async (options) => {
      const opts: ListMilestonesOptions = {
        project: options.project,
        limit: options.limit,
        json: options.json,
      };
      await listMilestones(opts);
    });
}
