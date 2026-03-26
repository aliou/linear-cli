import type { Command } from "commander";
import { setLocalWorkspace, setWorkspace } from "../../../commands/config";
import { strict } from "../../helpers";

export function registerConfigWorkspace(parent: Command): void {
  strict(parent.command("workspace"))
    .description("Set default workspace")
    .argument("<name>", "Workspace profile name")
    .option("--local", "Set local workspace instead of global default")
    .action(async (name: string, options: { local?: boolean }) => {
      if (options.local) {
        const result = await setLocalWorkspace(name);
        console.log(
          `Local workspace set to "${result.local.workspace}" in ${result.path}.`,
        );
        return;
      }

      await setWorkspace(name);
      console.log(`Default workspace set to "${name}".`);
    });
}
