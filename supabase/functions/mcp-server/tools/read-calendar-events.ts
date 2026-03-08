import { z } from "npm:zod";
import type { McpTool, AuthUser } from "../types.ts";
import { graphRequest } from "../graph-client.ts";

export const readCalendarEventsTool: McpTool = {
  register(server, _user) {
    server.tool(
      "read_calendar_events",

      "Read events from a specific calendar of a specific user. " +
        "Returns event subject, start/end times, location, attendees, and body. " +
        "Use this to check someone's schedule or look up meeting details.",

      {
        user_email: z
          .string()
          .email()
          .describe("The email address of the user whose calendar to read"),
        calendar_id: z
          .string()
          .optional()
          .describe(
            "The ID of the specific calendar to read. If omitted, reads from the user's default calendar.",
          ),
        start_date: z
          .string()
          .describe(
            "Start of the time range in ISO 8601 format (e.g. 2025-03-01T00:00:00Z)",
          ),
        end_date: z
          .string()
          .describe(
            "End of the time range in ISO 8601 format (e.g. 2025-03-31T23:59:59Z)",
          ),
        limit: z
          .number()
          .min(1)
          .max(50)
          .default(20)
          .describe("Maximum number of events to return (default: 20, max: 50)"),
      },

      async ({ user_email, calendar_id, start_date, end_date, limit }) => {
        try {
          const basePath = calendar_id
            ? `/users/${encodeURIComponent(user_email)}/calendars/${calendar_id}/calendarView`
            : `/users/${encodeURIComponent(user_email)}/calendarView`;

          const params: Record<string, string> = {
            startDateTime: start_date,
            endDateTime: end_date,
            $top: String(limit),
            $select:
              "id,subject,start,end,location,organizer,attendees,bodyPreview,isAllDay,isCancelled,showAs",
            $orderby: "start/dateTime asc",
          };

          const data = (await graphRequest(basePath, { params })) as {
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
                text: `Error reading calendar events for ${user_email}: ${(error as Error).message}`,
              },
            ],
            isError: true,
          };
        }
      },
    );
  },
};
