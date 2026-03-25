import type { Command } from "commander";
import {
  type CreateCommentOptions,
  createComment,
} from "../../../commands/comment";
import { addWorkspaceOption, resolveTextInput, strict } from "../../helpers";

export function registerCommentCreate(parent: Command): void {
  strict(addWorkspaceOption(parent.command("create")))
    .description("Create comment")
    .requiredOption("--issue <identifier>", "Issue identifier")
    .option("--body <text>", "Comment body")
    .option("--body-file <file>", "Read comment body from file")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      const body = await resolveTextInput({
        value: options.body,
        file: options.bodyFile,
        valueFlag: "--body",
        fileFlag: "--body-file",
        required: true,
      });

      const opts: CreateCommentOptions = {
        issue: options.issue,
        body: body ?? "",
        json: options.json,
      };
      await createComment(opts);
    });
}
