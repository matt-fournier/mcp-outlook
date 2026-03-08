import { z } from "npm:zod";
import type { McpTool, AuthUser } from "../types.ts";
import { graphRequest } from "../graph-client.ts";

export const listMailFoldersTool: McpTool = {
  register(server, _user) {
    server.tool(
      "list_mail_folders",

      "List mail folders in a user's mailbox. " +
        "Returns folder name, ID, unread count, and total count. " +
        "Use this to discover custom folders and their IDs, which can then be used with read_emails. " +
        "Can also list child folders of a specific parent folder.",

      {
        user_email: z
          .string()
          .email()
          .describe("The email address of the user whose mailbox folders to list"),
        parent_folder_id: z
          .string()
          .optional()
          .describe(
            "ID or well-known name of a parent folder to list child folders. " +
              "If omitted, lists top-level folders. " +
              "Well-known names: inbox, sentitems, drafts, deleteditems, junkemail, archive, outbox",
          ),
        include_hidden: z
          .boolean()
          .default(false)
          .describe(
            "When true, includes hidden/system folders. Default: false",
          ),
      },

      async ({ user_email, parent_folder_id, include_hidden }) => {
        try {
          const params: Record<string, string> = {
            $select:
              "id,displayName,parentFolderId,childFolderCount,unreadItemCount,totalItemCount,isHidden",
            $top: "100",
          };

          if (!include_hidden) {
            params.$filter = "isHidden eq false";
          }

          let endpoint: string;
          if (parent_folder_id) {
            endpoint = `/users/${encodeURIComponent(user_email)}/mailFolders/${encodeURIComponent(parent_folder_id)}/childFolders`;
          } else {
            endpoint = `/users/${encodeURIComponent(user_email)}/mailFolders`;
          }

          const data = (await graphRequest(endpoint, { params })) as {
            value: unknown[];
          };

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
                text: `Error listing mail folders for ${user_email}: ${(error as Error).message}`,
              },
            ],
            isError: true,
          };
        }
      },
    );
  },
};
