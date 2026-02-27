import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { registerKarbonTools } from "./karbon/tools.js";
import { registerOutlookTools } from "./outlook/tools.js";
import { registerReportingTools } from "./reporting/tools.js";

const server = new McpServer({
  name: "executive-assistant",
  version: "1.0.0",
  description:
    "Executive Assistant — manage Karbon work items, Outlook email & calendar, and generate operational reports",
});

// ── Prompts (reusable assistant instructions) ─────────────

server.prompt(
  "daily_standup",
  "Run a daily standup: review calendar, triage inbox, check overdue Karbon items",
  () => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Please run my daily standup:
1. Pull today's calendar events and summarize my schedule.
2. Show me unread high-importance emails and any flagged items needing action.
3. List overdue Karbon work items and tasks due today.
4. Recommend the top 3 things I should focus on this morning.`,
        },
      },
    ],
  }),
);

server.prompt(
  "weekly_ops_report",
  "Generate a weekly operational report across Karbon and Outlook",
  () => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Generate my weekly operational report:
1. Work status summary — items completed, in-progress, and overdue.
2. Team workload distribution — who is overloaded, who has capacity.
3. Time tracking summary for the past 7 days.
4. Email activity highlights — volume, response patterns, flagged items.
5. Upcoming deadlines for the next 7 days.
Provide actionable recommendations at the end.`,
        },
      },
    ],
  }),
);

server.prompt(
  "email_triage",
  "Triage inbox: categorize, flag action items, draft responses",
  () => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Please triage my inbox:
1. List my unread emails sorted by importance.
2. For each email, suggest an action: Reply, Delegate, Archive, or Flag for later.
3. For urgent items, draft a brief response for my review.
4. Categorize emails by topic (client work, internal, marketing, etc.).`,
        },
      },
    ],
  }),
);

server.prompt(
  "client_status_check",
  "Check the status of all work items for a specific client",
  { clientName: z.string().optional().describe("Client name to check") },
  ({ clientName }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Check the status of all work for client: ${clientName ?? "[please specify client name]"}
1. Search for the client in Karbon contacts/organizations.
2. List all work items associated with this client.
3. Show task completion progress for each work item.
4. Check for any recent notes or timeline activity.
5. Search my email for recent correspondence with this client.
Provide a concise status update I could share with a partner.`,
        },
      },
    ],
  }),
);

// ── Register all tools ────────────────────────────────────

registerKarbonTools(server);
registerOutlookTools(server);
registerReportingTools(server);

// ── Start ─────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Executive Assistant MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
