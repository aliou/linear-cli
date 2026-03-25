import type { Command } from "commander";
import { strict } from "../../helpers";
import { registerIssueClose } from "./close";
import { registerIssueCreate } from "./create";
import { registerIssueGet } from "./get";
import { registerIssueList } from "./list";
import { registerIssueUpdate } from "./update";

export function registerIssue(program: Command): void {
  const issue = strict(program.command("issue")).description(
    "Issue operations",
  );

  registerIssueList(issue);
  registerIssueGet(issue);
  registerIssueCreate(issue);
  registerIssueUpdate(issue);
  registerIssueClose(issue);
}
