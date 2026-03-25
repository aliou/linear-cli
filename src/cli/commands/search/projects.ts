import type { Command } from "commander";
import {
  type SearchProjectsOptions,
  searchProjects,
} from "../../../commands/search";
import { addWorkspaceOption, parsePositiveInt, strict } from "../../helpers";

export function registerSearchProjects(parent: Command): void {
  strict(addWorkspaceOption(parent.command("projects")))
    .description("Search projects")
    .argument("<term>")
    .option("--limit <n>", "Maximum results", parsePositiveInt("limit"))
    .option("--json", "Output as JSON")
    .action(async (term: string, options) => {
      const opts: SearchProjectsOptions = {
        term,
        limit: options.limit,
        json: options.json,
      };
      await searchProjects(opts);
    });
}
