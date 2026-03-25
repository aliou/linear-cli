import type { Command } from "commander";
import {
  type ListCommentsOptions,
  listComments,
} from "../../../commands/comment";
import { addWorkspaceOption, strict } from "../../helpers";

export function registerCommentList(parent: Command): void {
  strict(addWorkspaceOption(parent.command("list")))
    .description("List comments")
    .requiredOption("--issue <identifier>", "Issue identifier")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      const opts: ListCommentsOptions = {
        issue: options.issue,
        json: options.json,
      };
      await listComments(opts);
    });
}
