import type { Command } from "commander";
import {
  type CreateDocumentOptions,
  createDocument,
} from "../../../commands/document";
import { addWorkspaceOption, resolveTextInput, strict } from "../../helpers";

export function registerDocumentCreate(parent: Command): void {
  strict(addWorkspaceOption(parent.command("create")))
    .description("Create document")
    .requiredOption("--title <title>", "Document title")
    .option("--content <markdown>", "Document content markdown")
    .option("--content-file <file>", "Read document content from file")
    .option("--project <id>", "Project ID")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      const content = await resolveTextInput({
        value: options.content,
        file: options.contentFile,
        valueFlag: "--content",
        fileFlag: "--content-file",
        required: true,
      });

      const opts: CreateDocumentOptions = {
        title: options.title,
        content: content ?? "",
        project: options.project,
        json: options.json,
      };
      await createDocument(opts);
    });
}
