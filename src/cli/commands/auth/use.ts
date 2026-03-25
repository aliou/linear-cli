import type { Command } from "commander";
import { setDefaultWorkspace } from "../../../config";
import { strict } from "../../helpers";

export function registerAuthUse(parent: Command): void {
  strict(parent.command("use"))
    .description("Set default workspace profile")
    .argument("<name>", "Workspace profile name")
    .action(async (name: string) => {
      await setDefaultWorkspace(name);
      console.log(`Default workspace set to "${name}".`);
    });
}
