import tab from "@bomb.sh/tab/commander";
import { Command } from "commander";
import { resetWorkspaceContext, setWorkspaceContext } from "../commands/shared";
import { APP_NAME, VERSION } from "../constants";
import { strict } from "./helpers";
import { registerAllCommands } from "./registry";

export function createProgram(): Command {
  const program = strict(new Command());
  program
    .name(APP_NAME)
    .description("Access Linear from your terminal via GraphQL API")
    .version(VERSION, "-v, --version", "Show version")
    .helpOption("-h, --help", "Show help")
    .showHelpAfterError()
    .option("-w, --workspace <name>", "Use a specific workspace profile")
    .hook("preAction", (_command, actionCommand) => {
      const opts = actionCommand.optsWithGlobals<{ workspace?: string }>();
      setWorkspaceContext(opts.workspace);
    })
    .hook("postAction", () => {
      resetWorkspaceContext();
    });

  registerAllCommands(program);
  tab(program);

  return program;
}

export async function run(): Promise<void> {
  const program = createProgram();
  await program.parseAsync(process.argv);
}
