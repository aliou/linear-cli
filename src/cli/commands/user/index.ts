import type { Command } from "commander";
import { strict } from "../../helpers";
import { registerUserGet } from "./get";
import { registerUserList } from "./list";
import { registerUserMe } from "./me";

export function registerUser(program: Command): void {
  const user = strict(program.command("user")).description("User operations");

  registerUserList(user);
  registerUserGet(user);
  registerUserMe(user);
}
