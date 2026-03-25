import type { Command } from "commander";
import { strict } from "../../helpers";
import { registerCycleGet } from "./get";
import { registerCycleList } from "./list";

export function registerCycle(program: Command): void {
  const cycle = strict(program.command("cycle")).description(
    "Cycle operations",
  );
  registerCycleList(cycle);
  registerCycleGet(cycle);
}
