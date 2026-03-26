import type { Command } from "commander";
import { setGlobalTeam, setLocalTeam } from "../../../commands/config";
import { strict } from "../../helpers";

export function registerConfigTeam(parent: Command): void {
  strict(parent.command("team"))
    .description("Set default team key")
    .argument("<key>", "Team key")
    .option("--local", "Set local team instead of global default")
    .action(async (key: string, options: { local?: boolean }) => {
      if (options.local) {
        const result = await setLocalTeam(key);
        console.log(
          `Local defaultTeamKey set to "${result.local.defaultTeamKey}" in ${result.path}.`,
        );
        return;
      }

      await setGlobalTeam(key);
      console.log(`Global defaultTeamKey set to "${key}".`);
    });
}
