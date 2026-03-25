import type { Command } from "commander";
import {
  type DeleteCommentOptions,
  deleteComment,
} from "../../../commands/comment";
import { addWorkspaceOption, strict } from "../../helpers";

export function registerCommentDelete(parent: Command): void {
  strict(addWorkspaceOption(parent.command("delete")))
    .description("Delete comment")
    .argument("<id>")
    .option("--json", "Output as JSON")
    .action(async (id: string, options) => {
      const opts: DeleteCommentOptions = {
        id,
        json: options.json,
      };
      await deleteComment(opts);
    });
}
