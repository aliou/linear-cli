import type { Command } from "commander";
import {
  type SearchDocumentsOptions,
  searchDocuments,
} from "../../../commands/search";
import { addWorkspaceOption, parsePositiveInt, strict } from "../../helpers";

export function registerSearchDocuments(parent: Command): void {
  strict(addWorkspaceOption(parent.command("documents")))
    .description("Search documents")
    .argument("<term>")
    .option("--limit <n>", "Maximum results", parsePositiveInt("limit"))
    .option("--json", "Output as JSON")
    .action(async (term: string, options) => {
      const opts: SearchDocumentsOptions = {
        term,
        limit: options.limit,
        json: options.json,
      };
      await searchDocuments(opts);
    });
}
