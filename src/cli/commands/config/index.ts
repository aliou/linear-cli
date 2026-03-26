import type { Command } from "commander";
import { strict } from "../../helpers";
import { registerConfigTeam } from "./set-team";
import { registerConfigWorkspace } from "./set-workspace";

export function registerConfig(program: Command): void {
  const config = strict(program.command("config")).description(
    "Manage CLI configuration",
  );

  registerConfigWorkspace(config);
  registerConfigTeam(config);
}
