import type { Command } from "commander";
import { type CreateLabelOptions, createLabel } from "../../../commands/label";
import { addWorkspaceOption, resolveTextInput, strict } from "../../helpers";

export function registerLabelCreate(parent: Command): void {
  strict(addWorkspaceOption(parent.command("create")))
    .description("Create label")
    .requiredOption("--name <name>", "Label name")
    .requiredOption("--color <hex>", "Label color")
    .option("--team <key>", "Team key")
    .option("--description <text>", "Description")
    .option("--description-file <file>", "Read description from file")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      const description = await resolveTextInput({
        value: options.description,
        file: options.descriptionFile,
        valueFlag: "--description",
        fileFlag: "--description-file",
      });

      const opts: CreateLabelOptions = {
        name: options.name,
        color: options.color,
        team: options.team,
        description,
        json: options.json,
      };
      await createLabel(opts);
    });
}
