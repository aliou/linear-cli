import { graphql } from "../api.ts";
import {
  getNumber,
  getPositional,
  getString,
  parseArgs,
  wantsHelp,
} from "../args.ts";
import { pad, printTable, requireToken, useJson } from "./shared.ts";

const DOCUMENT_OPTIONS = {
  title: { type: "string" as const },
  content: { type: "string" as const },
  project: { type: "string" as const },
  limit: { type: "string" as const },
  json: { type: "boolean" as const },
};

export async function listDocuments(args: string[]): Promise<void> {
  const parsed = parseArgs(args, DOCUMENT_OPTIONS);

  if (wantsHelp(parsed)) {
    console.log(`
Usage: linear document list [options]

List documents.

Options:
  --project <id>   Filter by project ID
  --limit <n>      Number of documents to fetch (default: 50)
  --json           Output as JSON
  -h, --help       Show this help
`);
    return;
  }

  const token = await requireToken();
  const limit = getNumber(parsed, "limit") ?? 50;
  const projectId = getString(parsed, "project");

  const filter: Record<string, unknown> = {};
  if (projectId) {
    filter.project = { id: { eq: projectId } };
  }

  const query = `
    query Documents($first: Int, $filter: DocumentFilter) {
      documents(first: $first, filter: $filter) {
        nodes {
          id
          title
          icon
          color
          project { name }
          creator { name }
          createdAt
          updatedAt
        }
      }
    }
  `;

  const data = await graphql<{
    documents: {
      nodes: Array<{
        id: string;
        title: string;
        icon: string | null;
        color: string | null;
        project: { name: string } | null;
        creator: { name: string };
        createdAt: string;
        updatedAt: string;
      }>;
    };
  }>(token, query, {
    first: limit,
    filter: Object.keys(filter).length > 0 ? filter : undefined,
  });

  const documents = data.documents.nodes;

  if (await useJson(parsed)) {
    console.log(JSON.stringify(documents, null, 2));
    return;
  }

  if (documents.length === 0) {
    console.log("No documents found.");
    return;
  }

  const headers = ["TITLE", "PROJECT", "CREATOR", "CREATED"];
  const rows = documents.map((d) => [
    d.title,
    d.project?.name ?? "",
    d.creator.name,
    d.createdAt,
  ]);

  printTable(headers, rows);
}

export async function getDocument(args: string[]): Promise<void> {
  const parsed = parseArgs(args, { json: { type: "boolean" as const } });

  if (wantsHelp(parsed)) {
    console.log(`
Usage: linear document get <id>

Get document details by ID.

Options:
  --json       Output as JSON
  -h, --help   Show this help
`);
    return;
  }

  const id = getPositional(parsed, 0);
  if (!id) {
    console.error("Error: Document ID is required.");
    process.exit(1);
  }

  const token = await requireToken();

  const query = `
    query Document($id: String!) {
      document(id: $id) {
        id
        title
        content
        icon
        color
        project { name }
        creator { name email }
        createdAt
        updatedAt
        url
      }
    }
  `;

  const data = await graphql<{
    document: {
      id: string;
      title: string;
      content: string;
      icon: string | null;
      color: string | null;
      project: { name: string } | null;
      creator: { name: string; email: string };
      createdAt: string;
      updatedAt: string;
      url: string;
    };
  }>(token, query, { id });

  const doc = data.document;

  if (await useJson(parsed)) {
    console.log(JSON.stringify(doc, null, 2));
    return;
  }

  const fields: Array<[string, string]> = [
    ["Title", doc.title],
    ["ID", doc.id],
    ["Icon", doc.icon ?? ""],
    ["Color", doc.color ?? ""],
    ["Project", doc.project?.name ?? ""],
    ["Creator", `${doc.creator.name} <${doc.creator.email}>`],
    ["Created", doc.createdAt],
    ["Updated", doc.updatedAt],
    ["URL", doc.url],
  ];

  const maxKey = Math.max(...fields.map(([k]) => k.length));
  for (const [key, value] of fields) {
    if (value) {
      console.log(`${pad(key, maxKey)}  ${value}`);
    }
  }

  if (doc.content) {
    console.log(`\nContent:\n${doc.content}`);
  }
}

export async function createDocument(args: string[]): Promise<void> {
  const parsed = parseArgs(args, DOCUMENT_OPTIONS);

  if (wantsHelp(parsed)) {
    console.log(`
Usage: linear document create --title <title> --content <markdown> [options]

Create a new document.

Options:
  --title <title>      Document title (required)
  --content <markdown> Document content in markdown (required)
  --project <id>       Project ID
  --json               Output as JSON
  -h, --help           Show this help
`);
    return;
  }

  const title = getString(parsed, "title");
  const content = getString(parsed, "content");

  if (!title) {
    console.error("Error: --title is required.");
    process.exit(1);
  }
  if (!content) {
    console.error("Error: --content is required.");
    process.exit(1);
  }

  const token = await requireToken();
  const json = await useJson(parsed);

  const input: Record<string, unknown> = { title, content };

  const project = getString(parsed, "project");
  if (project) input.projectId = project;

  const mutation = `
    mutation DocumentCreate($input: DocumentCreateInput!) {
      documentCreate(input: $input) {
        success
        document {
          id
          title
          project { name }
          url
        }
      }
    }
  `;

  const data = await graphql<{
    documentCreate: {
      success: boolean;
      document: {
        id: string;
        title: string;
        project: { name: string } | null;
        url: string;
      };
    };
  }>(token, mutation, { input });

  if (!data.documentCreate.success) {
    console.error("Error: Failed to create document.");
    process.exit(1);
  }

  const doc = data.documentCreate.document;

  if (json) {
    console.log(JSON.stringify(doc, null, 2));
    return;
  }

  console.log(`Created ${doc.title}`);
  if (doc.project) {
    console.log(`Project: ${doc.project.name}`);
  }
  console.log(`URL: ${doc.url}`);
}

export async function updateDocument(args: string[]): Promise<void> {
  const parsed = parseArgs(args, DOCUMENT_OPTIONS);

  if (wantsHelp(parsed)) {
    console.log(`
Usage: linear document update <id> [options]

Update an existing document.

Options:
  --title <title>      New title
  --content <content>  New content
  --json               Output as JSON
  -h, --help           Show this help
`);
    return;
  }

  const id = getPositional(parsed, 0);
  if (!id) {
    console.error("Error: Document ID is required.");
    process.exit(1);
  }

  const token = await requireToken();
  const json = await useJson(parsed);

  const input: Record<string, unknown> = {};

  const title = getString(parsed, "title");
  if (title) input.title = title;

  const content = getString(parsed, "content");
  if (content) input.content = content;

  if (Object.keys(input).length === 0) {
    console.error("Error: No update flags provided.");
    process.exit(1);
  }

  const mutation = `
    mutation DocumentUpdate($id: String!, $input: DocumentUpdateInput!) {
      documentUpdate(id: $id, input: $input) {
        success
        document {
          id
          title
          url
        }
      }
    }
  `;

  const data = await graphql<{
    documentUpdate: {
      success: boolean;
      document: {
        id: string;
        title: string;
        url: string;
      };
    };
  }>(token, mutation, { id, input });

  if (!data.documentUpdate.success) {
    console.error("Error: Failed to update document.");
    process.exit(1);
  }

  const doc = data.documentUpdate.document;

  if (json) {
    console.log(JSON.stringify(doc, null, 2));
    return;
  }

  console.log(`Updated ${doc.title}`);
  console.log(`URL: ${doc.url}`);
}

export async function deleteDocument(args: string[]): Promise<void> {
  const parsed = parseArgs(args, { json: { type: "boolean" as const } });

  if (wantsHelp(parsed)) {
    console.log(`
Usage: linear document delete <id>

Delete a document.

Options:
  --json       Output as JSON
  -h, --help   Show this help
`);
    return;
  }

  const id = getPositional(parsed, 0);
  if (!id) {
    console.error("Error: Document ID is required.");
    process.exit(1);
  }

  const token = await requireToken();
  const json = await useJson(parsed);

  const mutation = `
    mutation DocumentDelete($id: String!) {
      documentDelete(id: $id) {
        success
      }
    }
  `;

  const data = await graphql<{
    documentDelete: {
      success: boolean;
    };
  }>(token, mutation, { id });

  if (!data.documentDelete.success) {
    console.error("Error: Failed to delete document.");
    process.exit(1);
  }

  if (json) {
    console.log(JSON.stringify({ id, deleted: true }, null, 2));
    return;
  }

  console.log(`Deleted document ${id}`);
}
