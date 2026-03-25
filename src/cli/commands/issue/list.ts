import type { Command } from "commander";
import { type ListIssuesOptions, listIssues } from "../../../commands/issue";
import { addWorkspaceOption, parsePositiveInt, strict } from "../../helpers";

export function registerIssueList(parent: Command): void {
  strict(addWorkspaceOption(parent.command("list")))
    .description("List issues")
    .option("--team <key>", "Filter by team key")
    .option("--assignee <value>", "Filter by assignee")
    .option("--delegate <value>", "Filter by delegate/agent")
    .option("--agent <value>", "Alias for --delegate")
    .option("--state <name>", "Filter by state")
    .option("--label <name>", "Filter by label")
    .option("--limit <n>", "Max results", parsePositiveInt("limit"))
    .option("--json", "Output as JSON")
    .action(async (options) => {
      const opts: ListIssuesOptions = {
        team: options.team,
        assignee: options.assignee,
        delegate: options.delegate,
        agent: options.agent,
        state: options.state,
        label: options.label,
        limit: options.limit,
        json: options.json,
      };
      await listIssues(opts);
    });
}
