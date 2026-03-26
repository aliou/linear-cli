import type { Command } from "commander";
import { type DeleteLabelOptions, deleteLabel } from "../../../commands/label";
import {
  addDangerOptions,
  addWorkspaceOption,
  guardDangerousAction,
  strict,
} from "../../helpers";

export function registerLabelDelete(parent: Command): void {
  strict(addDangerOptions(addWorkspaceOption(parent.command("delete"))))
    .description("Delete label")
    .argument("<id>")
    .option("--json", "Output as JSON")
    .action(async (id: string, options) => {
      const shouldRun = await guardDangerousAction({
        yes: options.yes,
        dryRun: options.dryRun,
        action: "Delete label",
        target: id,
        invocation: `linear label delete ${id}`,
      });
      if (!shouldRun) return;

      const opts: DeleteLabelOptions = { id, json: options.json };
      await deleteLabel(opts);
    });
}
