import type { Command } from "commander";
import { type GetIssueOptions, getIssue } from "../../../commands/issue";
import { addWorkspaceOption, strict } from "../../helpers";

export function registerIssueGet(parent: Command): void {
  strict(addWorkspaceOption(parent.command("get")))
    .description("Get issue by identifier")
    .argument("<identifier>", "Issue identifier or UUID")
    .option("--json", "Output as JSON")
    .action(async (identifier: string, options) => {
      const opts: GetIssueOptions = {
        identifier,
        json: options.json,
      };
      await getIssue(opts);
    });
}
