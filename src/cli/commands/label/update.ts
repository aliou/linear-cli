import type { Command } from "commander";
import { type UpdateLabelOptions, updateLabel } from "../../../commands/label";
import { addWorkspaceOption, resolveTextInput, strict } from "../../helpers";

export function registerLabelUpdate(parent: Command): void {
  strict(addWorkspaceOption(parent.command("update")))
    .description("Update label")
    .argument("<id>")
    .option("--name <name>", "New name")
    .option("--color <hex>", "New color")
    .option("--description <text>", "New description")
    .option("--description-file <file>", "Read new description from file")
    .option("--json", "Output as JSON")
    .action(async (id: string, options) => {
      const description = await resolveTextInput({
        value: options.description,
        file: options.descriptionFile,
        valueFlag: "--description",
        fileFlag: "--description-file",
      });

      const opts: UpdateLabelOptions = {
        id,
        name: options.name,
        color: options.color,
        description,
        json: options.json,
      };
      await updateLabel(opts);
    });
}
