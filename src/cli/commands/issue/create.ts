import type { Command } from "commander";
import { type CreateIssueOptions, createIssue } from "../../../commands/issue";
import {
  addWorkspaceOption,
  parseNonNegativeInt,
  parsePriority,
  resolveTextInput,
  strict,
} from "../../helpers";

export function registerIssueCreate(parent: Command): void {
  strict(addWorkspaceOption(parent.command("create")))
    .description("Create an issue")
    .requiredOption("--team <key>", "Team key")
    .requiredOption("--title <title>", "Issue title")
    .option("--description <text>", "Issue description")
    .option("--description-file <file>", "Read issue description from file")
    .option("--priority <0-4>", "Issue priority", parsePriority)
    .option("--assignee <value>", "Assignee")
    .option("--delegate <value>", "Delegate/agent")
    .option("--agent <value>", "Alias for --delegate")
    .option("--state <id>", "State ID")
    .option("--label <ids>", "Comma-separated label IDs")
    .option("--project <id>", "Project ID")
    .option("--estimate <n>", "Estimate", parseNonNegativeInt("estimate"))
    .option("--json", "Output as JSON")
    .action(async (options) => {
      const description = await resolveTextInput({
        value: options.description,
        file: options.descriptionFile,
        valueFlag: "--description",
        fileFlag: "--description-file",
      });

      const opts: CreateIssueOptions = {
        team: options.team,
        title: options.title,
        description,
        priority: options.priority,
        assignee: options.assignee,
        delegate: options.delegate,
        agent: options.agent,
        state: options.state,
        label: options.label,
        project: options.project,
        estimate: options.estimate,
        json: options.json,
      };
      await createIssue(opts);
    });
}
