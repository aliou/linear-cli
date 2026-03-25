import type { Command } from "commander";
import { type DeleteLabelOptions, deleteLabel } from "../../../commands/label";
import { addWorkspaceOption, strict } from "../../helpers";

export function registerLabelDelete(parent: Command): void {
  strict(addWorkspaceOption(parent.command("delete")))
    .description("Delete label")
    .argument("<id>")
    .option("--json", "Output as JSON")
    .action(async (id: string, options) => {
      const opts: DeleteLabelOptions = {
        id,
        json: options.json,
      };
      await deleteLabel(opts);
    });
}
