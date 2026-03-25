import type { Command } from "commander";
import {
  type UpdateMilestoneOptions,
  updateMilestone,
} from "../../../commands/milestone";
import { addWorkspaceOption, resolveTextInput, strict } from "../../helpers";

export function registerMilestoneUpdate(parent: Command): void {
  strict(addWorkspaceOption(parent.command("update")))
    .description("Update milestone")
    .argument("<id>")
    .option("--name <name>", "New name")
    .option("--description <text>", "New description")
    .option("--description-file <file>", "Read new description from file")
    .option("--targetDate <date>", "New target date")
    .option("--json", "Output as JSON")
    .action(async (id: string, options) => {
      const description = await resolveTextInput({
        value: options.description,
        file: options.descriptionFile,
        valueFlag: "--description",
        fileFlag: "--description-file",
      });

      const opts: UpdateMilestoneOptions = {
        id,
        name: options.name,
        description,
        targetDate: options.targetDate,
        json: options.json,
      };
      await updateMilestone(opts);
    });
}
