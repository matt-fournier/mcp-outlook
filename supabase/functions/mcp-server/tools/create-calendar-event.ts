import { z } from "npm:zod";
import type { McpTool, AuthUser } from "../types.ts";
import { graphRequest } from "../graph-client.ts";

export const createCalendarEventTool: McpTool = {
  register(server, _user) {
    server.tool(
      "create_calendar_event",

      "Create a new event in a specific calendar of a specific user. " +
        "Supports setting subject, time, location, body, and attendees. " +
        "Use this to schedule meetings or block time on someone's calendar.",

      {
        user_email: z
          .string()
          .email()
          .describe("The email address of the user whose calendar to add the event to"),
        calendar_id: z
          .string()
          .optional()
          .describe(
            "The ID of the specific calendar. If omitted, adds to the user's default calendar.",
          ),
        subject: z.string().describe("The subject / title of the event"),
        start: z
          .string()
          .describe("Event start time in ISO 8601 format (e.g. 2025-03-15T09:00:00)"),
        end: z
          .string()
          .describe("Event end time in ISO 8601 format (e.g. 2025-03-15T10:00:00)"),
        time_zone: z
          .string()
          .default("Eastern Standard Time")
          .describe(
            "Time zone for start/end times (e.g. Eastern Standard Time, Pacific Standard Time, UTC). Default: Eastern Standard Time",
          ),
        body: z
          .string()
          .optional()
          .describe("Optional body / description of the event (HTML supported)"),
        location: z
          .string()
          .optional()
          .describe("Optional location of the event (e.g. room name, address, or Teams link)"),
        attendees: z
          .array(z.string().email())
          .optional()
          .describe("Optional list of attendee email addresses to invite"),
        is_all_day: z
          .boolean()
          .default(false)
          .describe("Whether this is an all-day event (default: false)"),
        is_online_meeting: z
          .boolean()
          .default(false)
          .describe("Whether to create a Teams online meeting (default: false)"),
      },

      async ({
        user_email,
        calendar_id,
        subject,
        start,
        end,
        time_zone,
        body,
        location,
        attendees,
        is_all_day,
        is_online_meeting,
      }) => {
        try {
          const event: Record<string, unknown> = {
            subject,
            start: {
              dateTime: start,
              timeZone: time_zone,
            },
            end: {
              dateTime: end,
              timeZone: time_zone,
            },
            isAllDay: is_all_day,
            isOnlineMeeting: is_online_meeting,
          };

          if (is_online_meeting) {
            event.onlineMeetingProvider = "teamsForBusiness";
          }

          if (body) {
            event.body = {
              contentType: "HTML",
              content: body,
            };
          }

          if (location) {
            event.location = {
              displayName: location,
            };
          }

          if (attendees && attendees.length > 0) {
            event.attendees = attendees.map((email) => ({
              emailAddress: { address: email },
              type: "required",
            }));
          }

          const basePath = calendar_id
            ? `/users/${encodeURIComponent(user_email)}/calendars/${calendar_id}/events`
            : `/users/${encodeURIComponent(user_email)}/events`;

          const result = await graphRequest(basePath, {
            method: "POST",
            body: event,
          });

          const created = result as {
            id: string;
            subject: string;
            start: { dateTime: string };
            end: { dateTime: string };
            webLink: string;
          };

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    status: "Event created successfully",
                    id: created.id,
                    subject: created.subject,
                    start: created.start,
                    end: created.end,
                    webLink: created.webLink,
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
                text: `Error creating calendar event for ${user_email}: ${(error as Error).message}`,
              },
            ],
            isError: true,
          };
        }
      },
    );
  },
};
