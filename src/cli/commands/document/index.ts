import type { Command } from "commander";
import { strict } from "../../helpers";
import { registerDocumentCreate } from "./create";
import { registerDocumentDelete } from "./delete";
import { registerDocumentGet } from "./get";
import { registerDocumentList } from "./list";
import { registerDocumentUpdate } from "./update";

export function registerDocument(program: Command): void {
  const document = strict(program.command("document")).description(
    "Document operations",
  );

  registerDocumentList(document);
  registerDocumentGet(document);
  registerDocumentCreate(document);
  registerDocumentUpdate(document);
  registerDocumentDelete(document);
}
