import { graphql } from "../api.ts";
import { getPositional, getString, parseArgs, wantsHelp } from "../args.ts";
import {
  formatDate,
  printTable,
  requireToken,
  truncate,
  useJson,
} from "./shared.ts";

const COMMENT_OPTIONS = {
  issue: { type: "string" as const },
  body: { type: "string" as const },
  json: { type: "boolean" as const },
  limit: { type: "string" as const },
};

export async function listComments(args: string[]): Promise<void> {
  const parsed = parseArgs(args, COMMENT_OPTIONS);

  if (wantsHelp(parsed)) {
    console.log(`
Usage: linear comment list [options]

List comments on an issue.

Options:
  --issue <identifier>  Issue identifier (required)
  --json                Output as JSON
  -h, --help            Show this help
`);
    return;
  }

  const issueId = getString(parsed, "issue");
  if (!issueId) {
    console.error("Error: --issue is required.");
    console.error("Usage: linear comment list --issue <identifier>");
    process.exit(1);
  }

  const token = await requireToken();
  const json = await useJson(parsed);

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
  }>(token, query, { id: issueId });

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

export async function createComment(args: string[]): Promise<void> {
  const parsed = parseArgs(args, COMMENT_OPTIONS);

  if (wantsHelp(parsed)) {
    console.log(`
Usage: linear comment create [options]

Create a comment on an issue.

Options:
  --issue <identifier>  Issue identifier (required)
  --body <text>         Comment body (required)
  --json                Output as JSON
  -h, --help            Show this help
`);
    return;
  }

  const issueIdentifier = getString(parsed, "issue");
  if (!issueIdentifier) {
    console.error("Error: --issue is required.");
    console.error(
      "Usage: linear comment create --issue <identifier> --body <text>",
    );
    process.exit(1);
  }

  const body = getString(parsed, "body");
  if (!body) {
    console.error("Error: --body is required.");
    console.error(
      "Usage: linear comment create --issue <identifier> --body <text>",
    );
    process.exit(1);
  }

  const token = await requireToken();
  const json = await useJson(parsed);

  const issueQuery = `
    query Issue($id: String!) {
      issue(id: $id) {
        id
      }
    }
  `;

  const issueData = await graphql<{
    issue: { id: string };
  }>(token, issueQuery, { id: issueIdentifier });

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
  }>(token, mutation, { input: { issueId, body } });

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

export async function updateComment(args: string[]): Promise<void> {
  const parsed = parseArgs(args, COMMENT_OPTIONS);

  if (wantsHelp(parsed)) {
    console.log(`
Usage: linear comment update <comment-id> [options]

Update a comment.

Options:
  --body <text>   New comment body (required)
  --json          Output as JSON
  -h, --help      Show this help
`);
    return;
  }

  const id = getPositional(parsed, 0);
  if (!id) {
    console.error("Error: Comment ID is required.");
    console.error("Usage: linear comment update <comment-id> --body <text>");
    process.exit(1);
  }

  const body = getString(parsed, "body");
  if (!body) {
    console.error("Error: --body is required.");
    console.error("Usage: linear comment update <comment-id> --body <text>");
    process.exit(1);
  }

  const token = await requireToken();
  const json = await useJson(parsed);

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
  }>(token, mutation, { id, input: { body } });

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

export async function deleteComment(args: string[]): Promise<void> {
  const parsed = parseArgs(args, COMMENT_OPTIONS);

  if (wantsHelp(parsed)) {
    console.log(`
Usage: linear comment delete <comment-id>

Delete a comment.

Options:
  --json         Output as JSON
  -h, --help     Show this help
`);
    return;
  }

  const id = getPositional(parsed, 0);
  if (!id) {
    console.error("Error: Comment ID is required.");
    console.error("Usage: linear comment delete <comment-id>");
    process.exit(1);
  }

  const token = await requireToken();
  const json = await useJson(parsed);

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
  }>(token, mutation, { id });

  if (!data.commentDelete.success) {
    console.error("Error: Failed to delete comment.");
    process.exit(1);
  }

  if (json) {
    console.log(JSON.stringify({ id, deleted: true }, null, 2));
    return;
  }

  console.log(`Deleted comment ${id}`);
}
