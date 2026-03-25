import type { Command } from "commander";
import { strict } from "../../helpers";
import { registerProjectGet } from "./get";
import { registerProjectList } from "./list";

export function registerProject(program: Command): void {
  const project = strict(program.command("project")).description(
    "Project operations",
  );

  registerProjectList(project);
  registerProjectGet(project);
}
