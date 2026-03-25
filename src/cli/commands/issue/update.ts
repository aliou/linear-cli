import type { Command } from "commander";
import { type UpdateIssueOptions, updateIssue } from "../../../commands/issue";
import {
  addWorkspaceOption,
  parseNonNegativeInt,
  parsePriority,
  resolveTextInput,
  strict,
} from "../../helpers";

export function registerIssueUpdate(parent: Command): void {
  strict(addWorkspaceOption(parent.command("update")))
    .description("Update an issue")
    .argument("<identifier>", "Issue identifier or UUID")
    .option("--title <title>", "New title")
    .option("--description <text>", "New description")
    .option("--description-file <file>", "Read new description from file")
    .option("--priority <0-4>", "New priority", parsePriority)
    .option("--state <id>", "New state ID")
    .option("--assignee <value>", "New assignee")
    .option("--delegate <value>", "New delegate/agent")
    .option("--agent <value>", "Alias for --delegate")
    .option("--label <ids>", "New comma-separated label IDs")
    .option("--project <id>", "New project ID")
    .option("--estimate <n>", "New estimate", parseNonNegativeInt("estimate"))
    .option("--json", "Output as JSON")
    .action(async (identifier: string, options) => {
      const description = await resolveTextInput({
        value: options.description,
        file: options.descriptionFile,
        valueFlag: "--description",
        fileFlag: "--description-file",
      });

      const opts: UpdateIssueOptions = {
        identifier,
        title: options.title,
        description,
        priority: options.priority,
        state: options.state,
        assignee: options.assignee,
        delegate: options.delegate,
        agent: options.agent,
        label: options.label,
        project: options.project,
        estimate: options.estimate,
        json: options.json,
      };
      await updateIssue(opts);
    });
}
