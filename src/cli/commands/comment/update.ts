import type { Command } from "commander";
import {
  type UpdateCommentOptions,
  updateComment,
} from "../../../commands/comment";
import { addWorkspaceOption, resolveTextInput, strict } from "../../helpers";

export function registerCommentUpdate(parent: Command): void {
  strict(addWorkspaceOption(parent.command("update")))
    .description("Update comment")
    .argument("<id>")
    .option("--body <text>", "Updated comment body")
    .option("--body-file <file>", "Read updated comment body from file")
    .option("--json", "Output as JSON")
    .action(async (id: string, options) => {
      const body = await resolveTextInput({
        value: options.body,
        file: options.bodyFile,
        valueFlag: "--body",
        fileFlag: "--body-file",
        required: true,
      });

      const opts: UpdateCommentOptions = {
        id,
        body: body ?? "",
        json: options.json,
      };
      await updateComment(opts);
    });
}
