import type { Command } from "commander";
import {
  type GetInitiativeOptions,
  getInitiative,
} from "../../../commands/initiative";
import { addWorkspaceOption, strict } from "../../helpers";

export function registerInitiativeGet(parent: Command): void {
  strict(addWorkspaceOption(parent.command("get")))
    .description("Get initiative")
    .argument("<id>")
    .option("--json", "Output as JSON")
    .action(async (id: string, options) => {
      const opts: GetInitiativeOptions = {
        id,
        json: options.json,
      };
      await getInitiative(opts);
    });
}
