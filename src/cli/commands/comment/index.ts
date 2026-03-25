import type { Command } from "commander";
import { strict } from "../../helpers";
import { registerCommentCreate } from "./create";
import { registerCommentDelete } from "./delete";
import { registerCommentList } from "./list";
import { registerCommentUpdate } from "./update";

export function registerComment(program: Command): void {
  const comment = strict(program.command("comment")).description(
    "Comment operations",
  );

  registerCommentList(comment);
  registerCommentCreate(comment);
  registerCommentUpdate(comment);
  registerCommentDelete(comment);
}
