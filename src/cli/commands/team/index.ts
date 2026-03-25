import type { Command } from "commander";
import { strict } from "../../helpers";
import { registerTeamGet } from "./get";
import { registerTeamList } from "./list";

export function registerTeam(program: Command): void {
  const team = strict(program.command("team")).description("Team operations");
  registerTeamList(team);
  registerTeamGet(team);
}
