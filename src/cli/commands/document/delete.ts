import type { Command } from "commander";
import {
  type DeleteDocumentOptions,
  deleteDocument,
} from "../../../commands/document";
import { addWorkspaceOption, strict } from "../../helpers";

export function registerDocumentDelete(parent: Command): void {
  strict(addWorkspaceOption(parent.command("delete")))
    .description("Delete document")
    .argument("<id>")
    .option("--json", "Output as JSON")
    .action(async (id: string, options) => {
      const opts: DeleteDocumentOptions = {
        id,
        json: options.json,
      };
      await deleteDocument(opts);
    });
}
