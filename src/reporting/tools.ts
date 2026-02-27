import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as karbon from "../karbon/client.js";
import * as outlook from "../outlook/client.js";

export function registerReportingTools(server: McpServer) {
  // ── Daily Briefing ──────────────────────────────────────

  server.tool(
    "report_daily_briefing",
    "Generate a daily executive briefing: today's calendar, unread/flagged emails, overdue Karbon work items, and tasks due today",
    {
      date: z.string().optional().describe("Date to report on (ISO 8601, defaults to today)"),
    },
    async ({ date }) => {
      const today = date ?? new Date().toISOString().split("T")[0];
      const startOfDay = `${today}T00:00:00`;
      const endOfDay = `${today}T23:59:59`;

      const [calendarRes, unreadRes, flaggedRes, workItemsRes] =
        await Promise.allSettled([
          outlook.listCalendarEvents({
            startDateTime: startOfDay,
            endDateTime: endOfDay,
          }),
          outlook.listMessages({
            folder: "inbox",
            top: 20,
            filter: "isRead eq false",
            orderBy: "receivedDateTime desc",
            select:
              "id,subject,from,receivedDateTime,bodyPreview,importance",
          }),
          outlook.listMessages({
            folder: "inbox",
            top: 10,
            filter: "flag/flagStatus eq 'flagged'",
            orderBy: "receivedDateTime desc",
            select: "id,subject,from,receivedDateTime,bodyPreview",
          }),
          karbon.listWorkItems(`DueDate le '${today}'`),
        ]);

      const sections: string[] = [`# Daily Briefing — ${today}\n`];

      // Calendar
      sections.push("## Calendar");
      if (calendarRes.status === "fulfilled" && calendarRes.value.ok) {
        const events = ((calendarRes.value.data as { value?: unknown[] }).value ?? []) as outlook.CalendarEvent[];
        if (events.length === 0) {
          sections.push("No events scheduled today.\n");
        } else {
          events.forEach((e) => {
            const start = e.start?.dateTime?.split("T")[1]?.slice(0, 5) ?? "All day";
            sections.push(`- **${start}** ${e.subject} ${e.location?.displayName ? `@ ${e.location.displayName}` : ""}`);
          });
          sections.push("");
        }
      } else {
        sections.push("_Could not load calendar._\n");
      }

      // Unread Emails
      sections.push("## Unread Emails");
      if (unreadRes.status === "fulfilled" && unreadRes.value.ok) {
        const msgs = ((unreadRes.value.data as { value?: unknown[] }).value ?? []) as outlook.OutlookMessage[];
        if (msgs.length === 0) {
          sections.push("Inbox zero — no unread emails!\n");
        } else {
          msgs.forEach((m) => {
            const imp = m.importance === "high" ? " 🔴" : "";
            sections.push(
              `- **${m.from?.emailAddress?.name ?? m.from?.emailAddress?.address}**: ${m.subject}${imp}`,
            );
          });
          sections.push(`\n_${msgs.length} unread emails total._\n`);
        }
      } else {
        sections.push("_Could not load emails._\n");
      }

      // Flagged Emails
      sections.push("## Flagged / Action Required");
      if (flaggedRes.status === "fulfilled" && flaggedRes.value.ok) {
        const msgs = ((flaggedRes.value.data as { value?: unknown[] }).value ?? []) as outlook.OutlookMessage[];
        if (msgs.length === 0) {
          sections.push("No flagged emails.\n");
        } else {
          msgs.forEach((m) => {
            sections.push(
              `- **${m.from?.emailAddress?.name ?? "Unknown"}**: ${m.subject}`,
            );
          });
          sections.push("");
        }
      } else {
        sections.push("_Could not load flagged emails._\n");
      }

      // Overdue Work Items
      sections.push("## Karbon Work Items Due");
      if (workItemsRes.status === "fulfilled" && workItemsRes.value.ok) {
        const items = (Array.isArray(workItemsRes.value.data)
          ? workItemsRes.value.data
          : []) as karbon.KarbonWorkItem[];
        if (items.length === 0) {
          sections.push("No work items due today or overdue.\n");
        } else {
          items.forEach((w) => {
            sections.push(
              `- **${w.Title}** — Due: ${w.DueDate ?? "N/A"} | Key: ${w.WorkItemKey}`,
            );
          });
          sections.push("");
        }
      } else {
        sections.push("_Could not load work items._\n");
      }

      return {
        content: [{ type: "text" as const, text: sections.join("\n") }],
      };
    },
  );

  // ── Work Item Status Report ─────────────────────────────

  server.tool(
    "report_work_status_summary",
    "Generate a summary of all work items grouped by status, including counts and overdue items",
    {},
    async () => {
      const [itemsRes, statusesRes] = await Promise.allSettled([
        karbon.listWorkItems(),
        karbon.listWorkItemStatuses(),
      ]);

      if (
        itemsRes.status !== "fulfilled" ||
        !itemsRes.value.ok ||
        statusesRes.status !== "fulfilled" ||
        !statusesRes.value.ok
      ) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: Could not retrieve work items or statuses from Karbon.",
            },
          ],
        };
      }

      const items = (Array.isArray(itemsRes.value.data) ? itemsRes.value.data : []) as karbon.KarbonWorkItem[];
      const statuses = (Array.isArray(statusesRes.value.data) ? statusesRes.value.data : []) as karbon.KarbonWorkItemStatus[];

      const statusMap = new Map(statuses.map((s) => [s.WorkItemStatusKey, s.StatusName]));

      const grouped: Record<string, karbon.KarbonWorkItem[]> = {};
      for (const item of items) {
        const statusName = statusMap.get(item.WorkItemStatusKey ?? "") ?? "Unknown";
        (grouped[statusName] ??= []).push(item);
      }

      const today = new Date().toISOString().split("T")[0];
      const overdue = items.filter(
        (w) => w.DueDate && w.DueDate < today,
      );

      const sections: string[] = ["# Work Status Summary\n"];

      sections.push(`**Total Work Items:** ${items.length}`);
      sections.push(`**Overdue:** ${overdue.length}\n`);

      sections.push("## By Status");
      for (const [status, group] of Object.entries(grouped).sort(
        (a, b) => b[1].length - a[1].length,
      )) {
        sections.push(`### ${status} (${group.length})`);
        group.slice(0, 10).forEach((w) => {
          const due = w.DueDate ? ` — Due: ${w.DueDate}` : "";
          sections.push(`- ${w.Title}${due}`);
        });
        if (group.length > 10) {
          sections.push(`- _...and ${group.length - 10} more_`);
        }
        sections.push("");
      }

      if (overdue.length > 0) {
        sections.push("## Overdue Items");
        overdue.forEach((w) => {
          sections.push(`- **${w.Title}** — Due: ${w.DueDate}`);
        });
        sections.push("");
      }

      return {
        content: [{ type: "text" as const, text: sections.join("\n") }],
      };
    },
  );

  // ── Team Workload Report ────────────────────────────────

  server.tool(
    "report_team_workload",
    "Generate a team workload report showing work item and task distribution across team members",
    {},
    async () => {
      const [usersRes, itemsRes] = await Promise.allSettled([
        karbon.listUsers(),
        karbon.listWorkItems(),
      ]);

      if (
        usersRes.status !== "fulfilled" ||
        !usersRes.value.ok ||
        itemsRes.status !== "fulfilled" ||
        !itemsRes.value.ok
      ) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: Could not retrieve users or work items from Karbon.",
            },
          ],
        };
      }

      const users = (Array.isArray(usersRes.value.data) ? usersRes.value.data : []) as karbon.KarbonUser[];
      const items = (Array.isArray(itemsRes.value.data) ? itemsRes.value.data : []) as karbon.KarbonWorkItem[];

      const userMap = new Map(users.map((u) => [u.UserKey, u.FullName]));

      const byAssignee: Record<string, karbon.KarbonWorkItem[]> = {};
      const unassigned: karbon.KarbonWorkItem[] = [];
      for (const item of items) {
        if (item.AssigneeKey) {
          const name = userMap.get(item.AssigneeKey) ?? item.AssigneeKey;
          (byAssignee[name] ??= []).push(item);
        } else {
          unassigned.push(item);
        }
      }

      const sections: string[] = ["# Team Workload Report\n"];

      const sorted = Object.entries(byAssignee).sort(
        (a, b) => b[1].length - a[1].length,
      );
      for (const [name, group] of sorted) {
        const today = new Date().toISOString().split("T")[0];
        const overdueCount = group.filter(
          (w) => w.DueDate && w.DueDate < today,
        ).length;
        sections.push(`## ${name} — ${group.length} items${overdueCount > 0 ? ` (${overdueCount} overdue)` : ""}`);
        group.slice(0, 8).forEach((w) => {
          const due = w.DueDate ? ` — Due: ${w.DueDate}` : "";
          sections.push(`- ${w.Title}${due}`);
        });
        if (group.length > 8) {
          sections.push(`- _...and ${group.length - 8} more_`);
        }
        sections.push("");
      }

      if (unassigned.length > 0) {
        sections.push(`## Unassigned — ${unassigned.length} items`);
        unassigned.slice(0, 5).forEach((w) => {
          sections.push(`- ${w.Title}`);
        });
        if (unassigned.length > 5) {
          sections.push(`- _...and ${unassigned.length - 5} more_`);
        }
        sections.push("");
      }

      return {
        content: [{ type: "text" as const, text: sections.join("\n") }],
      };
    },
  );

  // ── Time Tracking Report ────────────────────────────────

  server.tool(
    "report_time_tracking",
    "Generate a time tracking report for a date range, summarized by team member and work item",
    {
      startDate: z.string().describe("Start date (ISO 8601, e.g. '2025-01-01')"),
      endDate: z.string().describe("End date (ISO 8601)"),
    },
    async ({ startDate, endDate }) => {
      const filter = `EntryDate ge '${startDate}' and EntryDate le '${endDate}'`;
      const [timeRes, usersRes] = await Promise.allSettled([
        karbon.listTimeEntries(filter),
        karbon.listUsers(),
      ]);

      if (
        timeRes.status !== "fulfilled" ||
        !timeRes.value.ok
      ) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: Could not retrieve time entries from Karbon.",
            },
          ],
        };
      }

      const entries = (Array.isArray(timeRes.value.data) ? timeRes.value.data : []) as karbon.KarbonTimeEntry[];
      const users = (usersRes.status === "fulfilled" && usersRes.value.ok && Array.isArray(usersRes.value.data))
        ? usersRes.value.data as karbon.KarbonUser[]
        : [];
      const userMap = new Map(users.map((u) => [u.UserKey, u.FullName]));

      const totalMinutes = entries.reduce((sum, e) => sum + (e.Minutes ?? 0), 0);

      // By team member
      const byUser: Record<string, number> = {};
      for (const entry of entries) {
        const name = userMap.get(entry.ContactKey ?? "") ?? entry.ContactKey ?? "Unknown";
        byUser[name] = (byUser[name] ?? 0) + (entry.Minutes ?? 0);
      }

      const sections: string[] = [
        `# Time Tracking Report`,
        `**Period:** ${startDate} to ${endDate}`,
        `**Total Hours:** ${(totalMinutes / 60).toFixed(1)}h (${entries.length} entries)\n`,
      ];

      sections.push("## By Team Member");
      const sortedUsers = Object.entries(byUser).sort((a, b) => b[1] - a[1]);
      for (const [name, mins] of sortedUsers) {
        sections.push(`- **${name}**: ${(mins / 60).toFixed(1)}h`);
      }
      sections.push("");

      // By work item
      const byWorkItem: Record<string, number> = {};
      for (const entry of entries) {
        const key = entry.WorkItemKey ?? "No Work Item";
        byWorkItem[key] = (byWorkItem[key] ?? 0) + (entry.Minutes ?? 0);
      }

      sections.push("## By Work Item");
      const sortedItems = Object.entries(byWorkItem).sort((a, b) => b[1] - a[1]);
      for (const [key, mins] of sortedItems.slice(0, 20)) {
        sections.push(`- **${key}**: ${(mins / 60).toFixed(1)}h`);
      }
      if (sortedItems.length > 20) {
        sections.push(`- _...and ${sortedItems.length - 20} more work items_`);
      }

      return {
        content: [{ type: "text" as const, text: sections.join("\n") }],
      };
    },
  );

  // ── Email Activity Report ───────────────────────────────

  server.tool(
    "report_email_summary",
    "Generate an email activity summary: inbox stats, unread count, high-importance items, and top senders",
    {},
    async () => {
      const [inboxRes, unreadRes, highRes, sentRes, foldersRes] =
        await Promise.allSettled([
          outlook.listMessages({
            folder: "inbox",
            top: 50,
            orderBy: "receivedDateTime desc",
            select: "id,subject,from,receivedDateTime,isRead,importance,hasAttachments",
          }),
          outlook.listMessages({
            folder: "inbox",
            top: 50,
            filter: "isRead eq false",
            select: "id,from",
          }),
          outlook.listMessages({
            folder: "inbox",
            top: 10,
            filter: "importance eq 'high' and isRead eq false",
            select: "id,subject,from,receivedDateTime",
          }),
          outlook.listMessages({
            folder: "sentitems",
            top: 30,
            orderBy: "sentDateTime desc",
            select: "id",
          }),
          outlook.listMailFolders(),
        ]);

      const sections: string[] = ["# Email Activity Summary\n"];

      // Folder stats
      if (foldersRes.status === "fulfilled" && foldersRes.value.ok) {
        const folders = ((foldersRes.value.data as { value?: unknown[] }).value ?? []) as outlook.MailFolder[];
        const inbox = folders.find((f) => f.displayName.toLowerCase() === "inbox");
        if (inbox) {
          sections.push(`**Inbox:** ${inbox.totalItemCount} total, ${inbox.unreadItemCount} unread`);
        }
        const sent = folders.find((f) => f.displayName.toLowerCase() === "sent items");
        if (sent) {
          sections.push(`**Sent Items:** ${sent.totalItemCount} total`);
        }
        sections.push("");
      }

      // High-importance unread
      sections.push("## High-Importance Unread");
      if (highRes.status === "fulfilled" && highRes.value.ok) {
        const msgs = ((highRes.value.data as { value?: unknown[] }).value ?? []) as outlook.OutlookMessage[];
        if (msgs.length === 0) {
          sections.push("No high-importance unread emails.\n");
        } else {
          msgs.forEach((m) => {
            sections.push(
              `- **${m.from?.emailAddress?.name ?? "Unknown"}**: ${m.subject} (${m.receivedDateTime?.split("T")[0]})`,
            );
          });
          sections.push("");
        }
      } else {
        sections.push("_Could not load._\n");
      }

      // Top senders
      sections.push("## Top Senders (recent inbox)");
      if (inboxRes.status === "fulfilled" && inboxRes.value.ok) {
        const msgs = ((inboxRes.value.data as { value?: unknown[] }).value ?? []) as outlook.OutlookMessage[];
        const senderCount: Record<string, number> = {};
        msgs.forEach((m) => {
          const addr = m.from?.emailAddress?.address ?? "unknown";
          senderCount[addr] = (senderCount[addr] ?? 0) + 1;
        });
        const sorted = Object.entries(senderCount).sort((a, b) => b[1] - a[1]);
        sorted.slice(0, 10).forEach(([addr, count]) => {
          sections.push(`- ${addr}: ${count} emails`);
        });
        sections.push("");
      } else {
        sections.push("_Could not load._\n");
      }

      return {
        content: [{ type: "text" as const, text: sections.join("\n") }],
      };
    },
  );

  // ── Overdue + Upcoming Deadlines ────────────────────────

  server.tool(
    "report_deadlines",
    "Show all overdue and upcoming (next 7 days) work item deadlines",
    {
      daysAhead: z.number().optional().describe("Number of days to look ahead (default: 7)"),
    },
    async ({ daysAhead }) => {
      const days = daysAhead ?? 7;
      const today = new Date();
      const future = new Date(today);
      future.setDate(future.getDate() + days);
      const todayStr = today.toISOString().split("T")[0];
      const futureStr = future.toISOString().split("T")[0];

      const res = await karbon.listWorkItems(
        `DueDate le '${futureStr}'`,
      );

      if (!res.ok) {
        return {
          content: [
            { type: "text" as const, text: `Error ${res.status}: ${JSON.stringify(res.data)}` },
          ],
        };
      }

      const items = (Array.isArray(res.data) ? res.data : []) as karbon.KarbonWorkItem[];
      const overdue = items.filter((w) => w.DueDate && w.DueDate < todayStr);
      const upcoming = items.filter(
        (w) => w.DueDate && w.DueDate >= todayStr && w.DueDate <= futureStr,
      );

      const sections: string[] = ["# Deadline Report\n"];

      sections.push(`## Overdue (${overdue.length})`);
      if (overdue.length === 0) {
        sections.push("No overdue items.\n");
      } else {
        overdue
          .sort((a, b) => (a.DueDate ?? "").localeCompare(b.DueDate ?? ""))
          .forEach((w) => {
            sections.push(`- **${w.Title}** — Due: ${w.DueDate}`);
          });
        sections.push("");
      }

      sections.push(`## Upcoming ${days} Days (${upcoming.length})`);
      if (upcoming.length === 0) {
        sections.push("No upcoming deadlines.\n");
      } else {
        upcoming
          .sort((a, b) => (a.DueDate ?? "").localeCompare(b.DueDate ?? ""))
          .forEach((w) => {
            sections.push(`- **${w.Title}** — Due: ${w.DueDate}`);
          });
        sections.push("");
      }

      return {
        content: [{ type: "text" as const, text: sections.join("\n") }],
      };
    },
  );
}
