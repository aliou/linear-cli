import type { Command } from "commander";
import { logout } from "../../../auth";
import { getWorkspaceContext } from "../../../commands/shared";
import { addWorkspaceOption, strict } from "../../helpers";

export function registerAuthLogout(parent: Command): void {
  strict(addWorkspaceOption(parent.command("logout")))
    .description("Remove stored credentials")
    .action(async (options) => {
      const workspace = options.workspace ?? getWorkspaceContext();
      await logout(workspace);
      if (workspace) {
        console.log(
          `Logged out from workspace "${workspace}". Token removed from config.`,
        );
      } else {
        console.log("Logged out. Token removed from config.");
      }
    });
}
