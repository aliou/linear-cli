import type { Command } from "commander";
import { strict } from "../../helpers";
import { registerAuthList } from "./list";
import { registerAuthLogin } from "./login";
import { registerAuthLogout } from "./logout";
import { registerAuthStatus } from "./status";
import { registerAuthUse } from "./use";

export function registerAuth(program: Command): void {
  const auth = strict(program.command("auth")).description(
    "Manage authentication",
  );

  registerAuthLogin(auth);
  registerAuthLogout(auth);
  registerAuthStatus(auth);
  registerAuthList(auth);
  registerAuthUse(auth);
}
