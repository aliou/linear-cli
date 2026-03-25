import type { Command } from "commander";
import { registerAuth } from "./commands/auth/index";
import { registerComment } from "./commands/comment/index";
import { registerCycle } from "./commands/cycle/index";
import { registerDocument } from "./commands/document/index";
import { registerGraphql } from "./commands/graphql/index";
import { registerInitiative } from "./commands/initiative/index";
import { registerIssue } from "./commands/issue/index";
import { registerLabel } from "./commands/label/index";
import { registerMilestone } from "./commands/milestone/index";
import { registerProject } from "./commands/project/index";
import { registerSearch } from "./commands/search/index";
import { registerState } from "./commands/state/index";
import { registerTeam } from "./commands/team/index";
import { registerUser } from "./commands/user/index";

export function registerAllCommands(program: Command): void {
  registerAuth(program);
  registerIssue(program);
  registerTeam(program);
  registerProject(program);
  registerCycle(program);
  registerComment(program);
  registerDocument(program);
  registerLabel(program);
  registerMilestone(program);
  registerInitiative(program);
  registerUser(program);
  registerState(program);
  registerSearch(program);
  registerGraphql(program);
}
