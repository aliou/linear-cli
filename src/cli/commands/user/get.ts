import type { Command } from "commander";
import { type GetUserOptions, getUser } from "../../../commands/user";
import { addWorkspaceOption, strict } from "../../helpers";

export function registerUserGet(parent: Command): void {
  strict(addWorkspaceOption(parent.command("get")))
    .description("Get user")
    .argument("<id>")
    .option("--json", "Output as JSON")
    .action(async (id: string, options) => {
      const opts: GetUserOptions = {
        id,
        json: options.json,
      };
      await getUser(opts);
    });
}
