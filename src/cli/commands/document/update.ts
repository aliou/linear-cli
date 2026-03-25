import type { Command } from "commander";
import {
  type UpdateDocumentOptions,
  updateDocument,
} from "../../../commands/document";
import { addWorkspaceOption, resolveTextInput, strict } from "../../helpers";

export function registerDocumentUpdate(parent: Command): void {
  strict(addWorkspaceOption(parent.command("update")))
    .description("Update document")
    .argument("<id>")
    .option("--title <title>", "New title")
    .option("--content <content>", "New content")
    .option("--content-file <file>", "Read new content from file")
    .option("--json", "Output as JSON")
    .action(async (id: string, options) => {
      const content = await resolveTextInput({
        value: options.content,
        file: options.contentFile,
        valueFlag: "--content",
        fileFlag: "--content-file",
      });

      const opts: UpdateDocumentOptions = {
        id,
        title: options.title,
        content,
        json: options.json,
      };
      await updateDocument(opts);
    });
}
