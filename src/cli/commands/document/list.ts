import type { Command } from "commander";
import {
  type ListDocumentsOptions,
  listDocuments,
} from "../../../commands/document";
import { addWorkspaceOption, parsePositiveInt, strict } from "../../helpers";

export function registerDocumentList(parent: Command): void {
  strict(addWorkspaceOption(parent.command("list")))
    .description("List documents")
    .option("--project <id>", "Filter by project ID")
    .option("--limit <n>", "Maximum results", parsePositiveInt("limit"))
    .option("--json", "Output as JSON")
    .action(async (options) => {
      const opts: ListDocumentsOptions = {
        project: options.project,
        limit: options.limit,
        json: options.json,
      };
      await listDocuments(opts);
    });
}
