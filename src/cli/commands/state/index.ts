import type { Command } from "commander";
import { strict } from "../../helpers";
import { registerStateList } from "./list";

export function registerState(program: Command): void {
  const state = strict(program.command("state")).description(
    "Workflow state operations",
  );
  registerStateList(state);
}
