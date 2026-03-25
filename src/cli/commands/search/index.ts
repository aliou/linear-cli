import type { Command } from "commander";
import { strict } from "../../helpers";
import { registerSearchDocuments } from "./documents";
import { registerSearchIssues } from "./issues";
import { registerSearchProjects } from "./projects";

export function registerSearch(program: Command): void {
  const search = strict(program.command("search")).description("Search");

  registerSearchIssues(search);
  registerSearchDocuments(search);
  registerSearchProjects(search);
}
