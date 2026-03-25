import type { Command } from "commander";
import { getAuthStatus } from "../../../auth";
import { getWorkspaceContext } from "../../../commands/shared";
import { addWorkspaceOption, strict } from "../../helpers";

export function registerAuthStatus(parent: Command): void {
  strict(addWorkspaceOption(parent.command("status")))
    .description("Show current authentication status")
    .action(async (options) => {
      const workspace = options.workspace ?? getWorkspaceContext();
      const status = await getAuthStatus(workspace);

      if (status.authenticated) {
        console.log("Status: Authenticated");
        console.log(`User: ${status.name}`);
        if (status.email) console.log(`Email: ${status.email}`);
        if (status.workspace) {
          console.log(
            `Workspace: ${status.orgName ?? status.workspace} (${status.workspace})`,
          );
        }
        console.log(
          `Token source: ${status.tokenSource === "env" ? "environment variable" : "config file"}`,
        );
      } else {
        console.log("Status: Not authenticated");
        if (status.error) {
          console.log(`Reason: ${status.error}`);
        }
        if (status.tokenSource) {
          console.log(
            `Token source: ${status.tokenSource === "env" ? "environment variable" : "config file"}`,
          );
        }
        process.exitCode = 1;
      }
    });
}
