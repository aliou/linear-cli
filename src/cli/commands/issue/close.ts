import type { Command } from "commander";
import { type CloseIssueOptions, closeIssue } from "../../../commands/issue";
import { addWorkspaceOption, strict } from "../../helpers";

export function registerIssueClose(parent: Command): void {
  strict(addWorkspaceOption(parent.command("close")))
    .description("Close an issue")
    .argument("<identifier>", "Issue identifier or UUID")
    .option("--json", "Output as JSON")
    .action(async (identifier: string, options) => {
      const opts: CloseIssueOptions = {
        identifier,
        json: options.json,
      };
      await closeIssue(opts);
    });
}
