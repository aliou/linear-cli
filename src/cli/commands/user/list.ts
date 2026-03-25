import type { Command } from "commander";
import { type ListUsersOptions, listUsers } from "../../../commands/user";
import { addWorkspaceOption, parsePositiveInt, strict } from "../../helpers";

export function registerUserList(parent: Command): void {
  strict(addWorkspaceOption(parent.command("list")))
    .description("List users")
    .option("--limit <n>", "Maximum results", parsePositiveInt("limit"))
    .option("--json", "Output as JSON")
    .action(async (options) => {
      const opts: ListUsersOptions = {
        limit: options.limit,
        json: options.json,
      };
      await listUsers(opts);
    });
}
