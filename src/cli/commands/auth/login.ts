import type { Command } from "commander";
import ora from "ora";
import { login, promptForToken, readTokenFromStdin } from "../../../auth";
import { getWorkspaceContext } from "../../../commands/shared";
import { getConfigPath } from "../../../config";
import { CliError } from "../../../errors";
import { addWorkspaceOption, strict } from "../../helpers";

export function registerAuthLogin(parent: Command): void {
  strict(addWorkspaceOption(parent.command("login")))
    .description("Authenticate with API token")
    .option("--token <token>", "Token value")
    .action(async (options) => {
      const workspace = options.workspace ?? getWorkspaceContext();
      let token: string | undefined = options.token;

      if (!token) {
        token = (await readTokenFromStdin()) ?? undefined;
      }

      if (!token && !process.stdin.isTTY) {
        throw new CliError("No token provided.", {
          suggestion:
            "Use --token <token> or pipe token via stdin. Example: echo $LINEAR_API_TOKEN | linear auth login",
        });
      }

      if (!token) {
        token = await promptForToken();
      }

      if (!token) {
        throw new CliError("No token provided.", {
          suggestion:
            "Use --token <token> or run interactively and paste token when prompted.",
        });
      }

      const spinner = ora({
        text: "Validating token...",
        isSilent: !process.stderr.isTTY,
      }).start();

      const result = await login(token, { workspace });

      if (!result.success) {
        spinner.fail("Login failed");
        throw new Error(result.error ?? "Unknown login error");
      }

      spinner.succeed("Authenticated");
      console.log(
        `Authenticated as: ${result.name}${result.email ? ` (${result.email})` : ""}`,
      );
      if (result.workspace) {
        console.log(
          `Workspace: ${result.orgName ?? result.workspace} (${result.workspace})`,
        );
      }
      console.log(`Token saved to: ${getConfigPath()}`);
    });
}
