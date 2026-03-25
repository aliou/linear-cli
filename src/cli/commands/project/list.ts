import { type Command, Option } from "commander";
import {
  type ListProjectsOptions,
  listProjects,
} from "../../../commands/project";
import { addWorkspaceOption, parsePositiveInt, strict } from "../../helpers";

export function registerProjectList(parent: Command): void {
  strict(addWorkspaceOption(parent.command("list")))
    .description("List projects")
    .option("--limit <n>", "Maximum results", parsePositiveInt("limit"))
    .addOption(
      new Option("--status <status>", "Project status").choices([
        "planned",
        "started",
        "paused",
        "completed",
        "canceled",
      ]),
    )
    .option("--json", "Output as JSON")
    .action(async (options) => {
      const opts: ListProjectsOptions = {
        limit: options.limit,
        status: options.status,
        json: options.json,
      };
      await listProjects(opts);
    });
}
