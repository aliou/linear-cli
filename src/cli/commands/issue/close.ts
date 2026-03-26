import type { Command } from "commander";
import { type CloseIssueOptions, closeIssue } from "../../../commands/issue";
import {
  addDangerOptions,
  addWorkspaceOption,
  guardDangerousAction,
  strict,
} from "../../helpers";

export function registerIssueClose(parent: Command): void {
  strict(addDangerOptions(addWorkspaceOption(parent.command("close"))))
    .description("Close an issue")
    .argument("<identifier>", "Issue identifier or UUID")
    .option("--json", "Output as JSON")
    .action(async (identifier: string, options) => {
      const shouldRun = await guardDangerousAction({
        yes: options.yes,
        dryRun: options.dryRun,
        action: "Close issue",
        target: identifier,
        invocation: `linear issue close ${identifier}`,
      });
      if (!shouldRun) return;

      const opts: CloseIssueOptions = { identifier, json: options.json };
      await closeIssue(opts);
    });
}
