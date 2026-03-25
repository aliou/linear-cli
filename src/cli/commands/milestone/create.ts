import type { Command } from "commander";
import {
  type CreateMilestoneOptions,
  createMilestone,
} from "../../../commands/milestone";
import { addWorkspaceOption, resolveTextInput, strict } from "../../helpers";

export function registerMilestoneCreate(parent: Command): void {
  strict(addWorkspaceOption(parent.command("create")))
    .description("Create milestone")
    .requiredOption("--project <id>", "Project ID")
    .requiredOption("--name <name>", "Milestone name")
    .option("--description <text>", "Description")
    .option("--description-file <file>", "Read description from file")
    .option("--targetDate <date>", "Target date (YYYY-MM-DD)")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      const description = await resolveTextInput({
        value: options.description,
        file: options.descriptionFile,
        valueFlag: "--description",
        fileFlag: "--description-file",
      });

      const opts: CreateMilestoneOptions = {
        project: options.project,
        name: options.name,
        description,
        targetDate: options.targetDate,
        json: options.json,
      };
      await createMilestone(opts);
    });
}
