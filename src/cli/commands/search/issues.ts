import type { Command } from "commander";
import {
  type SearchIssuesOptions,
  searchIssues,
} from "../../../commands/search";
import { addWorkspaceOption, parsePositiveInt, strict } from "../../helpers";

export function registerSearchIssues(parent: Command): void {
  strict(addWorkspaceOption(parent.command("issues")))
    .description("Search issues")
    .argument("<term>")
    .option("--team <key>", "Filter by team")
    .option("--limit <n>", "Maximum results", parsePositiveInt("limit"))
    .option("--json", "Output as JSON")
    .action(async (term: string, options) => {
      const opts: SearchIssuesOptions = {
        term,
        team: options.team,
        limit: options.limit,
        json: options.json,
      };
      await searchIssues(opts);
    });
}
