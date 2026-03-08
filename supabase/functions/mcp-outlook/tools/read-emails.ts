import { z } from "npm:zod";
import type { McpTool, AuthUser } from "../types.ts";
import { graphRequest } from "../graph-client.ts";

export const readEmailsTool: McpTool = {
  register(server, _user) {
    server.tool(
      "read_emails",

      "Read emails from a specific user's mailbox. " +
        "Returns subject, sender, date, body preview, and read status. " +
        "Use this to check a user's inbox, sent items, or any mail folder.",

      {
        user_email: z
          .string()
          .email()
          .describe("The email address of the user whose mailbox to read"),
        folder: z
          .string()
          .default("inbox")
          .describe(
            "Mail folder to read from. Use a well-known name (inbox, sentitems, drafts, deleteditems, junkemail, archive) or a folder ID from list_mail_folders. Default: inbox",
          ),
        limit: z
          .number()
          .min(1)
          .max(50)
          .default(10)
          .describe("Maximum number of emails to return (default: 10, max: 50)"),
        focused_only: z
          .boolean()
          .default(true)
          .describe(
            "When true (default), only return emails from the Focused inbox, excluding the 'Other' tab. Set to false to include all emails.",
          ),
        filter: z
          .string()
          .optional()
          .describe(
            "OData filter expression. Example: \"isRead eq false\" or \"from/emailAddress/address eq 'john@example.com'\"",
          ),
        search: z
          .string()
          .optional()
          .describe(
            "Search query to find emails by keywords in subject, body, or sender",
          ),
      },

      async ({ user_email, folder, limit, focused_only, filter, search }) => {
        try {
          const params: Record<string, string> = {
            $top: String(limit),
            $select:
              "id,subject,from,toRecipients,receivedDateTime,bodyPreview,isRead,hasAttachments,inferenceClassification",
            $orderby: "receivedDateTime desc",
          };

          // Build $filter: combine focused_only with any user-provided filter
          const filters: string[] = [];
          if (focused_only) {
            filters.push("inferenceClassification eq 'focused'");
          }
          if (filter) {
            filters.push(filter);
          }
          if (filters.length > 0) {
            params.$filter = filters.join(" and ");
          }
          if (search) params.$search = `"${search}"`;

          const data = (await graphRequest(
            `/users/${encodeURIComponent(user_email)}/mailFolders/${folder}/messages`,
            { params },
          )) as { value: unknown[] };

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(data.value, null, 2),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error reading emails for ${user_email}: ${(error as Error).message}`,
              },
            ],
            isError: true,
          };
        }
      },
    );
  },
};
