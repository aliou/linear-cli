import { graphql } from "../api.ts";
import { pad, printTable, requireToken, useJson } from "./shared.ts";

export interface ListDocumentsOptions {
  project?: string;
  limit?: number;
  json?: boolean;
}

export async function listDocuments(
  options: ListDocumentsOptions,
): Promise<void> {
  const token = await requireToken();
  const limit = options.limit ?? 50;

  const filter: Record<string, unknown> = {};
  if (options.project) {
    filter.project = { id: { eq: options.project } };
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

  if (await useJson(options.json)) {
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

export interface GetDocumentOptions {
  id: string;
  json?: boolean;
}

export async function getDocument(options: GetDocumentOptions): Promise<void> {
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
  }>(token, query, { id: options.id });

  const doc = data.document;

  if (await useJson(options.json)) {
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

export interface CreateDocumentOptions {
  title: string;
  content: string;
  project?: string;
  json?: boolean;
}

export async function createDocument(
  options: CreateDocumentOptions,
): Promise<void> {
  const token = await requireToken();
  const json = await useJson(options.json);

  const input: Record<string, unknown> = {
    title: options.title,
    content: options.content,
  };

  if (options.project) input.projectId = options.project;

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

export interface UpdateDocumentOptions {
  id: string;
  title?: string;
  content?: string;
  json?: boolean;
}

export async function updateDocument(
  options: UpdateDocumentOptions,
): Promise<void> {
  const token = await requireToken();
  const json = await useJson(options.json);

  const input: Record<string, unknown> = {};

  if (options.title) input.title = options.title;
  if (options.content) input.content = options.content;

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
  }>(token, mutation, { id: options.id, input });

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

export interface DeleteDocumentOptions {
  id: string;
  json?: boolean;
}

export async function deleteDocument(
  options: DeleteDocumentOptions,
): Promise<void> {
  const token = await requireToken();
  const json = await useJson(options.json);

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
  }>(token, mutation, { id: options.id });

  if (!data.documentDelete.success) {
    console.error("Error: Failed to delete document.");
    process.exit(1);
  }

  if (json) {
    console.log(JSON.stringify({ id: options.id, deleted: true }, null, 2));
    return;
  }

  console.log(`Deleted document ${options.id}`);
}
