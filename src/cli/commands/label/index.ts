import type { Command } from "commander";
import { strict } from "../../helpers";
import { registerLabelCreate } from "./create";
import { registerLabelDelete } from "./delete";
import { registerLabelList } from "./list";
import { registerLabelUpdate } from "./update";

export function registerLabel(program: Command): void {
  const label = strict(program.command("label")).description(
    "Label operations",
  );

  registerLabelList(label);
  registerLabelCreate(label);
  registerLabelUpdate(label);
  registerLabelDelete(label);
}
