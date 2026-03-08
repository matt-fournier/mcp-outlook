import { z } from "npm:zod";
import type { McpTool, AuthUser } from "../types.ts";
import { graphRequest } from "../graph-client.ts";

export const createDraftTool: McpTool = {
  register(server, _user) {
    server.tool(
      "create_draft_email",

      "Create a draft email in a specific user's drafts folder. " +
        "The email is saved as a draft and NOT sent. " +
        "Use this to prepare an email for a user to review before sending.",

      {
        user_email: z
          .string()
          .email()
          .describe("The email address of the user in whose drafts folder to create the email"),
        subject: z.string().describe("The subject line of the email"),
        body: z.string().describe("The body content of the email (HTML supported)"),
        body_type: z
          .enum(["Text", "HTML"])
          .default("HTML")
          .describe("The format of the body content: Text or HTML (default: HTML)"),
        to_recipients: z
          .array(z.string().email())
          .describe("List of recipient email addresses (To field)"),
        cc_recipients: z
          .array(z.string().email())
          .optional()
          .describe("Optional list of CC recipient email addresses"),
        importance: z
          .enum(["low", "normal", "high"])
          .default("normal")
          .describe("Email importance level (default: normal)"),
      },

      async ({
        user_email,
        subject,
        body,
        body_type,
        to_recipients,
        cc_recipients,
        importance,
      }) => {
        try {
          const message: Record<string, unknown> = {
            subject,
            body: {
              contentType: body_type,
              content: body,
            },
            toRecipients: to_recipients.map((email) => ({
              emailAddress: { address: email },
            })),
            importance,
          };

          if (cc_recipients && cc_recipients.length > 0) {
            message.ccRecipients = cc_recipients.map((email) => ({
              emailAddress: { address: email },
            }));
          }

          const result = await graphRequest(
            `/users/${encodeURIComponent(user_email)}/messages`,
            {
              method: "POST",
              body: message,
            },
          );

          const created = result as { id: string; subject: string; createdDateTime: string };

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    status: "Draft created successfully",
                    id: created.id,
                    subject: created.subject,
                    createdDateTime: created.createdDateTime,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error creating draft for ${user_email}: ${(error as Error).message}`,
              },
            ],
            isError: true,
          };
        }
      },
    );
  },
};
