import type { Command } from "commander";
import {
  type DeleteDocumentOptions,
  deleteDocument,
} from "../../../commands/document";
import {
  addDangerOptions,
  addWorkspaceOption,
  guardDangerousAction,
  strict,
} from "../../helpers";

export function registerDocumentDelete(parent: Command): void {
  strict(addDangerOptions(addWorkspaceOption(parent.command("delete"))))
    .description("Delete document")
    .argument("<id>")
    .option("--json", "Output as JSON")
    .action(async (id: string, options) => {
      const shouldRun = await guardDangerousAction({
        yes: options.yes,
        dryRun: options.dryRun,
        action: "Delete document",
        target: id,
        invocation: `linear document delete ${id}`,
      });
      if (!shouldRun) return;

      const opts: DeleteDocumentOptions = { id, json: options.json };
      await deleteDocument(opts);
    });
}
