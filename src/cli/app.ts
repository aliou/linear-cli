import tab from "@bomb.sh/tab/commander";
import { Command } from "commander";
import { resetWorkspaceContext, setWorkspaceContext } from "../commands/shared";
import { APP_NAME, VERSION } from "../constants";
import { strict } from "./helpers";
import { registerAllCommands } from "./registry";

function addAutoExamples(command: Command, lineage: string[] = []): void {
  const path = [...lineage, command.name()].filter(Boolean);
  const children = command.commands.filter((child) => child.name() !== "help");

  if (children.length === 0 && path.length > 1) {
    const args = command.registeredArguments
      .map((arg) => (arg.required ? `<${arg.name()}>` : `[${arg.name()}]`))
      .join(" ");
    const base = [APP_NAME, ...path.slice(1), args].filter(Boolean).join(" ");
    command.addHelpText("after", `\nExamples:\n  ${base}\n  ${base} --json`);
    return;
  }

  for (const child of children) {
    addAutoExamples(child, path);
  }
}

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
  addAutoExamples(program);

  return program;
}

export async function run(): Promise<void> {
  const program = createProgram();
  await program.parseAsync(process.argv);
}
