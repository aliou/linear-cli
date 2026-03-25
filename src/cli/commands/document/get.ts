import type { Command } from "commander";
import {
  type GetDocumentOptions,
  getDocument,
} from "../../../commands/document";
import { addWorkspaceOption, strict } from "../../helpers";

export function registerDocumentGet(parent: Command): void {
  strict(addWorkspaceOption(parent.command("get")))
    .description("Get document by ID")
    .argument("<id>")
    .option("--json", "Output as JSON")
    .action(async (id: string, options) => {
      const opts: GetDocumentOptions = {
        id,
        json: options.json,
      };
      await getDocument(opts);
    });
}
