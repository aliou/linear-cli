import type { Command } from "commander";
import { type GetProjectOptions, getProject } from "../../../commands/project";
import { addWorkspaceOption, strict } from "../../helpers";

export function registerProjectGet(parent: Command): void {
  strict(addWorkspaceOption(parent.command("get")))
    .description("Get project by ID")
    .argument("<id>")
    .option("--json", "Output as JSON")
    .action(async (id: string, options) => {
      const opts: GetProjectOptions = {
        id,
        json: options.json,
      };
      await getProject(opts);
    });
}
