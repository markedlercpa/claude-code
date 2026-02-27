import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as outlook from "./client.js";

export function registerOutlookTools(server: McpServer) {
  // ── Email Messages ──────────────────────────────────────

  server.tool(
    "outlook_list_emails",
    "List emails from Outlook. Search across inbox, sent items, or other folders. Supports filtering and search queries.",
    {
      folder: z.string().optional().describe("Mail folder: inbox, sentitems, drafts, deleteditems, etc. (default: inbox)"),
      top: z.number().optional().describe("Max number of emails to return (default: 25)"),
      filter: z.string().optional().describe("OData $filter (e.g. \"isRead eq false\", \"importance eq 'high'\")"),
      search: z.string().optional().describe("Free-text search (searches subject, body, and participants)"),
      orderBy: z.string().optional().describe("Sort order (e.g. \"receivedDateTime desc\")"),
    },
    async (params) => {
      const res = await outlook.listMessages({
        folder: params.folder,
        top: params.top ?? 25,
        filter: params.filter,
        search: params.search,
        orderBy: params.orderBy ?? "receivedDateTime desc",
        select: "id,subject,from,receivedDateTime,bodyPreview,isRead,importance,flag,categories,hasAttachments",
      });
      if (!res.ok) return { content: [{ type: "text" as const, text: `Error ${res.status}: ${JSON.stringify(res.data)}` }] };
      const messages = (res.data as { value: outlook.OutlookMessage[] }).value ?? res.data;
      const summary = (Array.isArray(messages) ? messages : []).map((m) => ({
        id: m.id,
        subject: m.subject,
        from: m.from?.emailAddress?.address,
        date: m.receivedDateTime,
        preview: m.bodyPreview?.slice(0, 120),
        isRead: m.isRead,
        importance: m.importance,
        flagged: m.flag?.flagStatus,
        categories: m.categories,
        hasAttachments: m.hasAttachments,
      }));
      return { content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }] };
    },
  );

  server.tool(
    "outlook_get_email",
    "Get the full content of a specific email by its ID",
    { messageId: z.string().describe("The email message ID") },
    async ({ messageId }) => {
      const res = await outlook.getMessage(messageId);
      if (!res.ok) return { content: [{ type: "text" as const, text: `Error ${res.status}: ${JSON.stringify(res.data)}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(res.data, null, 2) }] };
    },
  );

  server.tool(
    "outlook_send_email",
    "Send an email via Outlook",
    {
      subject: z.string().describe("Email subject"),
      body: z.string().describe("Email body (HTML supported)"),
      to: z.array(z.string()).describe("List of recipient email addresses"),
      cc: z.array(z.string()).optional().describe("CC recipients"),
      importance: z.enum(["low", "normal", "high"]).optional().describe("Email importance level"),
    },
    async (params) => {
      const res = await outlook.sendEmail({
        subject: params.subject,
        body: params.body,
        toRecipients: params.to,
        ccRecipients: params.cc,
        importance: params.importance,
      });
      if (!res.ok) return { content: [{ type: "text" as const, text: `Error ${res.status}: ${JSON.stringify(res.data)}` }] };
      return { content: [{ type: "text" as const, text: "Email sent successfully." }] };
    },
  );

  server.tool(
    "outlook_reply_to_email",
    "Reply to a specific email",
    {
      messageId: z.string().describe("The email message ID to reply to"),
      comment: z.string().describe("Reply body text (HTML supported)"),
    },
    async ({ messageId, comment }) => {
      const res = await outlook.replyToEmail(messageId, comment);
      if (!res.ok) return { content: [{ type: "text" as const, text: `Error ${res.status}: ${JSON.stringify(res.data)}` }] };
      return { content: [{ type: "text" as const, text: "Reply sent successfully." }] };
    },
  );

  server.tool(
    "outlook_forward_email",
    "Forward an email to other recipients",
    {
      messageId: z.string().describe("The email message ID to forward"),
      to: z.array(z.string()).describe("Recipient email addresses"),
      comment: z.string().optional().describe("Additional comment to include"),
    },
    async ({ messageId, to, comment }) => {
      const res = await outlook.forwardEmail(messageId, to, comment);
      if (!res.ok) return { content: [{ type: "text" as const, text: `Error ${res.status}: ${JSON.stringify(res.data)}` }] };
      return { content: [{ type: "text" as const, text: "Email forwarded successfully." }] };
    },
  );

  server.tool(
    "outlook_update_email",
    "Update email properties (mark read/unread, flag, categorize, change importance)",
    {
      messageId: z.string().describe("The email message ID"),
      isRead: z.boolean().optional().describe("Mark as read/unread"),
      flagStatus: z.enum(["notFlagged", "flagged", "complete"]).optional().describe("Flag status"),
      categories: z.array(z.string()).optional().describe("Category labels to assign"),
      importance: z.enum(["low", "normal", "high"]).optional().describe("Importance level"),
    },
    async ({ messageId, isRead, flagStatus, categories, importance }) => {
      const updates: Record<string, unknown> = {};
      if (isRead !== undefined) updates.isRead = isRead;
      if (flagStatus) updates.flag = { flagStatus };
      if (categories) updates.categories = categories;
      if (importance) updates.importance = importance;
      const res = await outlook.updateMessage(messageId, updates);
      if (!res.ok) return { content: [{ type: "text" as const, text: `Error ${res.status}: ${JSON.stringify(res.data)}` }] };
      return { content: [{ type: "text" as const, text: "Email updated successfully." }] };
    },
  );

  server.tool(
    "outlook_move_email",
    "Move an email to a different folder",
    {
      messageId: z.string().describe("The email message ID"),
      destinationFolder: z.string().describe("Target folder name or ID (e.g. 'archive', 'deleteditems')"),
    },
    async ({ messageId, destinationFolder }) => {
      const res = await outlook.moveMessage(messageId, destinationFolder);
      if (!res.ok) return { content: [{ type: "text" as const, text: `Error ${res.status}: ${JSON.stringify(res.data)}` }] };
      return { content: [{ type: "text" as const, text: "Email moved successfully." }] };
    },
  );

  server.tool(
    "outlook_delete_email",
    "Delete an email (moves to Deleted Items)",
    { messageId: z.string().describe("The email message ID to delete") },
    async ({ messageId }) => {
      const res = await outlook.deleteMessage(messageId);
      if (!res.ok) return { content: [{ type: "text" as const, text: `Error ${res.status}: ${JSON.stringify(res.data)}` }] };
      return { content: [{ type: "text" as const, text: "Email deleted." }] };
    },
  );

  server.tool(
    "outlook_list_folders",
    "List all mail folders with unread counts",
    {},
    async () => {
      const res = await outlook.listMailFolders();
      if (!res.ok) return { content: [{ type: "text" as const, text: `Error ${res.status}: ${JSON.stringify(res.data)}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(res.data, null, 2) }] };
    },
  );

  // ── Calendar ────────────────────────────────────────────

  server.tool(
    "outlook_list_calendar_events",
    "List upcoming calendar events or events within a date range",
    {
      startDateTime: z.string().optional().describe("Start of date range (ISO 8601, e.g. '2025-01-01T00:00:00')"),
      endDateTime: z.string().optional().describe("End of date range (ISO 8601)"),
      top: z.number().optional().describe("Max number of events to return"),
    },
    async (params) => {
      const res = await outlook.listCalendarEvents({
        startDateTime: params.startDateTime,
        endDateTime: params.endDateTime,
        top: params.top,
      });
      if (!res.ok) return { content: [{ type: "text" as const, text: `Error ${res.status}: ${JSON.stringify(res.data)}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(res.data, null, 2) }] };
    },
  );

  server.tool(
    "outlook_create_calendar_event",
    "Create a new calendar event / meeting",
    {
      subject: z.string().describe("Event title"),
      startDateTime: z.string().describe("Start time (ISO 8601)"),
      endDateTime: z.string().describe("End time (ISO 8601)"),
      timeZone: z.string().optional().describe("Time zone (default: UTC)"),
      body: z.string().optional().describe("Event description (HTML supported)"),
      location: z.string().optional().describe("Location name"),
      attendees: z.array(z.string()).optional().describe("Attendee email addresses"),
      isAllDay: z.boolean().optional().describe("All-day event?"),
    },
    async (params) => {
      const tz = params.timeZone ?? "UTC";
      const res = await outlook.createCalendarEvent({
        subject: params.subject,
        start: { dateTime: params.startDateTime, timeZone: tz },
        end: { dateTime: params.endDateTime, timeZone: tz },
        body: params.body,
        location: params.location,
        attendees: params.attendees,
        isAllDay: params.isAllDay,
      });
      if (!res.ok) return { content: [{ type: "text" as const, text: `Error ${res.status}: ${JSON.stringify(res.data)}` }] };
      return { content: [{ type: "text" as const, text: `Event created:\n${JSON.stringify(res.data, null, 2)}` }] };
    },
  );

  server.tool(
    "outlook_delete_calendar_event",
    "Delete / cancel a calendar event",
    { eventId: z.string().describe("The calendar event ID") },
    async ({ eventId }) => {
      const res = await outlook.deleteCalendarEvent(eventId);
      if (!res.ok) return { content: [{ type: "text" as const, text: `Error ${res.status}: ${JSON.stringify(res.data)}` }] };
      return { content: [{ type: "text" as const, text: "Event deleted." }] };
    },
  );
}
