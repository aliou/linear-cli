import type { Command } from "commander";
import { type MeOptions, me } from "../../../commands/user";
import { addWorkspaceOption, strict } from "../../helpers";

export function registerUserMe(parent: Command): void {
  strict(addWorkspaceOption(parent.command("me")))
    .description("Get authenticated user")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      const opts: MeOptions = {
        json: options.json,
      };
      await me(opts);
    });
}
