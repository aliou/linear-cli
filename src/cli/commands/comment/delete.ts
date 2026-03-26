import type { Command } from "commander";
import {
  type DeleteCommentOptions,
  deleteComment,
} from "../../../commands/comment";
import {
  addDangerOptions,
  addWorkspaceOption,
  guardDangerousAction,
  strict,
} from "../../helpers";

export function registerCommentDelete(parent: Command): void {
  strict(addDangerOptions(addWorkspaceOption(parent.command("delete"))))
    .description("Delete comment")
    .argument("<id>")
    .option("--json", "Output as JSON")
    .action(async (id: string, options) => {
      const shouldRun = await guardDangerousAction({
        yes: options.yes,
        dryRun: options.dryRun,
        action: "Delete comment",
        target: id,
        invocation: `linear comment delete ${id}`,
      });
      if (!shouldRun) return;

      const opts: DeleteCommentOptions = { id, json: options.json };
      await deleteComment(opts);
    });
}
