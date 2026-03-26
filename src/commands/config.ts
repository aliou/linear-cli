import { access } from "node:fs/promises";
import { join } from "node:path";
import {
  DEFAULT_LOCAL_CONFIG_PATHS,
  type LocalConfig,
  loadConfig,
  loadLocalConfigFromPath,
  resolveWorkspaceFromGlobalConfig,
  saveLocalConfigToPath,
  setDefaultWorkspace,
  updateConfig,
  type WorkspaceProfile,
} from "../config";
import { CliError } from "../errors";

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function resolveWritableLocalConfigPath(): Promise<string> {
  for (const relPath of DEFAULT_LOCAL_CONFIG_PATHS) {
    const path = join(process.cwd(), relPath);
    if (await pathExists(path)) {
      return path;
    }
  }

  return join(process.cwd(), ".linear.json");
}

function getDefaultTeamFromGlobal(
  profile: WorkspaceProfile | undefined,
  globalDefaultTeam: string | undefined,
): string | undefined {
  return profile?.defaultTeamKey ?? globalDefaultTeam;
}

export async function setWorkspace(workspace: string): Promise<void> {
  await setDefaultWorkspace(workspace);
}

export async function setGlobalTeam(teamKey: string): Promise<void> {
  await updateConfig({ defaultTeamKey: teamKey });
}

export async function setLocalWorkspace(
  workspace?: string,
): Promise<{ path: string; local: LocalConfig }> {
  const config = await loadConfig();
  const workspaceName = workspace ?? resolveWorkspaceFromGlobalConfig(config);

  if (!workspaceName) {
    throw new CliError("No workspace value to set locally.", {
      suggestion:
        "Pass a workspace explicitly, or set a global default with 'linear auth use <name>'.",
    });
  }

  if (!config.workspaces?.[workspaceName]) {
    throw new CliError(`Workspace "${workspaceName}" not found in config.`, {
      suggestion:
        "Run 'linear auth list' to see available workspaces, or 'linear auth login --workspace " +
        workspaceName +
        "' to add one.",
    });
  }

  const path = await resolveWritableLocalConfigPath();
  const existing = (await loadLocalConfigFromPath(path)) ?? {};
  const local: LocalConfig = { ...existing, workspace: workspaceName };
  await saveLocalConfigToPath(path, local);

  return { path, local };
}

export async function setLocalTeam(
  teamKey?: string,
): Promise<{ path: string; local: LocalConfig }> {
  const config = await loadConfig();
  const workspaceName = resolveWorkspaceFromGlobalConfig(config);
  const workspaceProfile = workspaceName
    ? config.workspaces?.[workspaceName]
    : undefined;

  const resolvedTeam =
    teamKey ??
    getDefaultTeamFromGlobal(workspaceProfile, config.defaultTeamKey);

  if (!resolvedTeam) {
    throw new CliError("No team value to set locally.", {
      suggestion:
        "Pass a team explicitly, or set a global/workspace defaultTeamKey in config.",
    });
  }

  const path = await resolveWritableLocalConfigPath();
  const existing = (await loadLocalConfigFromPath(path)) ?? {};
  const local: LocalConfig = { ...existing, defaultTeamKey: resolvedTeam };
  await saveLocalConfigToPath(path, local);

  return { path, local };
}
