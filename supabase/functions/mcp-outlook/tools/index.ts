import { readEmailsTool } from "./read-emails.ts";
import { listMailFoldersTool } from "./list-mail-folders.ts";
import { createDraftTool } from "./create-draft.ts";
import { readCalendarEventsTool } from "./read-calendar-events.ts";
import { createCalendarEventTool } from "./create-calendar-event.ts";

export const allTools = [
  readEmailsTool,
  listMailFoldersTool,
  createDraftTool,
  readCalendarEventsTool,
  createCalendarEventTool,
];
