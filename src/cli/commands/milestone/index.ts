import type { Command } from "commander";
import { strict } from "../../helpers";
import { registerMilestoneCreate } from "./create";
import { registerMilestoneDelete } from "./delete";
import { registerMilestoneGet } from "./get";
import { registerMilestoneList } from "./list";
import { registerMilestoneUpdate } from "./update";

export function registerMilestone(program: Command): void {
  const milestone = strict(program.command("milestone")).description(
    "Milestone operations",
  );

  registerMilestoneList(milestone);
  registerMilestoneGet(milestone);
  registerMilestoneCreate(milestone);
  registerMilestoneUpdate(milestone);
  registerMilestoneDelete(milestone);
}
