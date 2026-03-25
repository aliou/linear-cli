import type { Command } from "commander";
import { strict } from "../../helpers";
import { registerInitiativeGet } from "./get";
import { registerInitiativeList } from "./list";

export function registerInitiative(program: Command): void {
  const initiative = strict(program.command("initiative")).description(
    "Initiative operations",
  );

  registerInitiativeList(initiative);
  registerInitiativeGet(initiative);
}
