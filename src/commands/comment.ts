import { graphql } from "../api.ts";
import {
  formatDate,
  printTable,
  requireToken,
  truncate,
  useJson,
} from "./shared.ts";

export interface ListCommentsOptions {
  issue: string;
  json?: boolean;
}

export async function listComments(
  options: ListCommentsOptions,
): Promise<void> {
  const token = await requireToken();
  const json = await useJson(options.json);

  const query = `
    query IssueComments($id: String!) {
      issue(id: $id) {
        comments {
          nodes {
            id
            body
            user { name }
            createdAt
            updatedAt
          }
        }
      }
    }
  `;

  const data = await graphql<{
    issue: {
      comments: {
        nodes: Array<{
          id: string;
          body: string;
          user: { name: string } | null;
          createdAt: string;
          updatedAt: string;
        }>;
      };
    };
  }>(token, query, { id: options.issue });

  const comments = data.issue.comments.nodes;

  if (json) {
    console.log(JSON.stringify(comments, null, 2));
    return;
  }

  if (comments.length === 0) {
    console.log("No comments found.");
    return;
  }

  const headers = ["ID", "AUTHOR", "BODY", "CREATED"];
  const rows = comments.map((c) => [
    c.id,
    c.user?.name ?? "-",
    truncate(c.body, 80),
    formatDate(c.createdAt),
  ]);
  printTable(headers, rows);
}

export interface CreateCommentOptions {
  issue: string;
  body: string;
  json?: boolean;
}

export async function createComment(
  options: CreateCommentOptions,
): Promise<void> {
  const token = await requireToken();
  const json = await useJson(options.json);

  const issueQuery = `
    query Issue($id: String!) {
      issue(id: $id) {
        id
      }
    }
  `;

  const issueData = await graphql<{
    issue: { id: string };
  }>(token, issueQuery, { id: options.issue });

  const issueId = issueData.issue.id;

  const mutation = `
    mutation CommentCreate($input: CommentCreateInput!) {
      commentCreate(input: $input) {
        success
        comment {
          id
          body
          user { name }
          createdAt
          url
        }
      }
    }
  `;

  const data = await graphql<{
    commentCreate: {
      success: boolean;
      comment: {
        id: string;
        body: string;
        user: { name: string } | null;
        createdAt: string;
        url: string;
      };
    };
  }>(token, mutation, { input: { issueId, body: options.body } });

  if (!data.commentCreate.success) {
    console.error("Error: Failed to create comment.");
    process.exit(1);
  }

  const comment = data.commentCreate.comment;

  if (json) {
    console.log(JSON.stringify(comment, null, 2));
    return;
  }

  console.log(`Created comment ${comment.id}`);
  console.log(`Author: ${comment.user?.name ?? "-"}`);
  console.log(`URL: ${comment.url}`);
}

export interface UpdateCommentOptions {
  id: string;
  body: string;
  json?: boolean;
}

export async function updateComment(
  options: UpdateCommentOptions,
): Promise<void> {
  const token = await requireToken();
  const json = await useJson(options.json);

  const mutation = `
    mutation CommentUpdate($id: String!, $input: CommentUpdateInput!) {
      commentUpdate(id: $id, input: $input) {
        success
        comment {
          id
          body
          updatedAt
        }
      }
    }
  `;

  const data = await graphql<{
    commentUpdate: {
      success: boolean;
      comment: {
        id: string;
        body: string;
        updatedAt: string;
      };
    };
  }>(token, mutation, { id: options.id, input: { body: options.body } });

  if (!data.commentUpdate.success) {
    console.error("Error: Failed to update comment.");
    process.exit(1);
  }

  const comment = data.commentUpdate.comment;

  if (json) {
    console.log(JSON.stringify(comment, null, 2));
    return;
  }

  console.log(`Updated comment ${comment.id}`);
  console.log(`Updated: ${formatDate(comment.updatedAt)}`);
}

export interface DeleteCommentOptions {
  id: string;
  json?: boolean;
}

export async function deleteComment(
  options: DeleteCommentOptions,
): Promise<void> {
  const token = await requireToken();
  const json = await useJson(options.json);

  const mutation = `
    mutation CommentDelete($id: String!) {
      commentDelete(id: $id) {
        success
      }
    }
  `;

  const data = await graphql<{
    commentDelete: {
      success: boolean;
    };
  }>(token, mutation, { id: options.id });

  if (!data.commentDelete.success) {
    console.error("Error: Failed to delete comment.");
    process.exit(1);
  }

  if (json) {
    console.log(JSON.stringify({ id: options.id, deleted: true }, null, 2));
    return;
  }

  console.log(`Deleted comment ${options.id}`);
}
