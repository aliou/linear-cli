import type { Command } from "commander";
import { type GetCycleOptions, getCycle } from "../../../commands/cycle";
import { addWorkspaceOption, strict } from "../../helpers";

export function registerCycleGet(parent: Command): void {
  strict(addWorkspaceOption(parent.command("get")))
    .description("Get cycle by ID")
    .argument("<id>")
    .option("--json", "Output as JSON")
    .action(async (id: string, options) => {
      const opts: GetCycleOptions = {
        id,
        json: options.json,
      };
      await getCycle(opts);
    });
}
