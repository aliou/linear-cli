import { graphql } from "../api.ts";
import { printTable, requireToken, useJson } from "./shared.ts";

interface TeamMember {
  id: string;
  name: string;
  email?: string;
}

interface TeamState {
  id: string;
  name: string;
  type: string;
}

interface TeamLabel {
  id: string;
  name: string;
  color: string;
}

interface Team {
  id: string;
  key: string;
  name: string;
  description: string;
  members: { nodes: TeamMember[] };
  states?: { nodes: TeamState[] };
  labels?: { nodes: TeamLabel[] };
  cyclesEnabled?: boolean;
  issueCount: number;
  createdAt: string;
  updatedAt?: string;
}

export interface ListTeamsOptions {
  limit?: number;
  json?: boolean;
}

export async function listTeams(options: ListTeamsOptions): Promise<void> {
  const token = await requireToken();
  const limit = options.limit ?? 50;
  const json = await useJson(options.json);

  const query = `
    query Teams($first: Int) {
      teams(first: $first) {
        nodes {
          id
          key
          name
          description
          members { nodes { id name } }
          issueCount
          createdAt
        }
      }
    }
  `;

  const data = await graphql<{ teams: { nodes: Team[] } }>(token, query, {
    first: limit,
  });

  const teams = data.teams.nodes;

  if (json) {
    console.log(JSON.stringify(teams, null, 2));
    return;
  }

  if (teams.length === 0) {
    console.log("No teams found.");
    return;
  }

  const headers = ["KEY", "NAME", "MEMBERS", "ISSUES"];
  const rows = teams.map((t) => [
    t.key,
    t.name,
    String(t.members.nodes.length),
    String(t.issueCount),
  ]);

  printTable(headers, rows);
}

export interface GetTeamOptions {
  teamRef: string;
  json?: boolean;
}

export async function getTeam(options: GetTeamOptions): Promise<void> {
  const token = await requireToken();
  const json = await useJson(options.json);

  const isUuid = options.teamRef.includes("-") && options.teamRef.length > 20;

  let team: Team;

  if (isUuid) {
    const query = `
      query Team($id: String!) {
        team(id: $id) {
          id
          key
          name
          description
          members { nodes { id name email } }
          states { nodes { id name type } }
          labels { nodes { id name color } }
          cyclesEnabled
          issueCount
          createdAt
          updatedAt
        }
      }
    `;

    const data = await graphql<{ team: Team }>(token, query, {
      id: options.teamRef,
    });
    team = data.team;
  } else {
    const query = `
      query Teams($filter: TeamFilter!) {
        teams(filter: $filter, first: 1) {
          nodes {
            id
            key
            name
            description
            members { nodes { id name email } }
            states { nodes { id name type } }
            labels { nodes { id name color } }
            cyclesEnabled
            issueCount
            createdAt
            updatedAt
          }
        }
      }
    `;

    const data = await graphql<{ teams: { nodes: Team[] } }>(token, query, {
      filter: { key: { eq: options.teamRef.toUpperCase() } },
    });

    if (data.teams.nodes.length === 0) {
      console.error(`Error: Team "${options.teamRef}" not found.`);
      process.exit(1);
    }

    team = data.teams.nodes[0] as Team;
  }

  if (json) {
    console.log(JSON.stringify(team, null, 2));
    return;
  }

  console.log(`Key:            ${team.key}`);
  console.log(`Name:           ${team.name}`);
  console.log(`ID:             ${team.id}`);
  console.log(`Description:    ${team.description || "(none)"}`);
  console.log(`Issues:         ${team.issueCount}`);
  console.log(`Cycles enabled: ${team.cyclesEnabled ?? false}`);
  console.log(`Created:        ${team.createdAt}`);
  if (team.updatedAt) {
    console.log(`Updated:        ${team.updatedAt}`);
  }

  if (team.members?.nodes.length) {
    console.log(`\nMembers (${team.members.nodes.length}):`);
    for (const m of team.members.nodes) {
      console.log(`  ${m.name}${m.email ? ` <${m.email}>` : ""}`);
    }
  }

  if (team.states?.nodes.length) {
    console.log(`\nStates (${team.states.nodes.length}):`);
    for (const s of team.states.nodes) {
      console.log(`  ${s.name} (${s.type})`);
    }
  }

  if (team.labels?.nodes.length) {
    console.log(`\nLabels (${team.labels.nodes.length}):`);
    for (const l of team.labels.nodes) {
      console.log(`  ${l.name} (${l.color})`);
    }
  }
}
