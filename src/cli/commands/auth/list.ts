import type { Command } from "commander";
import { printTable } from "../../../commands/shared";
import { loadConfig } from "../../../config";
import { strict } from "../../helpers";

export function registerAuthList(parent: Command): void {
  strict(parent.command("list"))
    .description("List configured workspace profiles")
    .action(async () => {
      const config = await loadConfig();
      const entries = Object.entries(config.workspaces ?? {});

      if (entries.length === 0) {
        console.log("No workspace profiles configured.");
        return;
      }

      const rows = entries.map(([name, profile]) => {
        const type = profile.apiToken ? "api" : "-";
        const marker = config.defaultWorkspace === name ? "*" : "";
        return [name, profile.orgName ?? "-", type, marker];
      });

      printTable(["NAME", "ORG", "TYPE", "DEFAULT"], rows);
    });
}
