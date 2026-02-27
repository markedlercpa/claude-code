import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { registerKarbonTools } from "./karbon/tools.js";
import { registerOutlookTools } from "./outlook/tools.js";
import { registerReportingTools } from "./reporting/tools.js";
import { registerMetaAdsTools } from "./meta/tools.js";
import { registerCanvaTools } from "./canva/tools.js";
import { registerCreativeTools } from "./creative/tools.js";
import { registerLandingPageTools } from "./landing/tools.js";
import { registerFunnelTools } from "./funnel/tools.js";
import { registerAdReportingTools } from "./ad-reporting/tools.js";

const server = new McpServer({
  name: "executive-assistant",
  version: "2.0.0",
  description:
    "Executive Assistant + Ad Funnel Agent — manage Karbon work items, Outlook email & calendar, operational reports, AND build/manage/optimize full ad funnels with Meta Ads, Canva creatives, landing pages, and intelligent CAC/LTV reporting",
});

// ── Prompts: Operations ──────────────────────────────────

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

// ── Prompts: Ad Funnel Agent ─────────────────────────────

server.prompt(
  "build_ad_funnel",
  "Build a complete ad funnel from scratch: strategy, creatives, landing pages, ads, and tracking",
  {
    offer: z.string().describe("What you're selling"),
    avatar: z.string().describe("Target customer description"),
    budget: z.string().optional().describe("Monthly ad budget"),
    pricePoint: z.string().optional().describe("Product/service price"),
  },
  ({ offer, avatar, budget, pricePoint }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Build me a complete ad funnel for the following:

**Offer:** ${offer}
**Target Avatar:** ${avatar}
${budget ? `**Budget:** ${budget}/month` : ""}
${pricePoint ? `**Price Point:** ${pricePoint}` : ""}

Execute the full funnel build:

1. **Strategy** — Use \`funnel_design_strategy\` to design the optimal funnel type and architecture for this offer/avatar/price point. Focus on CAC liquidation speed and CAC:LTV optimization.

2. **Offer Stack** — Use \`creative_design_offer\` to build a compelling offer with bonuses, guarantee, and urgency elements.

3. **Hooks** — Use \`creative_generate_hooks\` to generate 10+ scroll-stopping hooks for ad creatives.

4. **Ad Copy** — Use \`creative_write_ad_copy\` to write 3-5 ad copy variants for Meta using the best hooks.

5. **VSL Script** — If the funnel uses video, use \`creative_write_vsl_script\` to write the sales video script.

6. **Landing Pages** — Use \`landing_generate_page\` for each page in the funnel (opt-in, sales page, thank you, etc.).

7. **Email Sequences** — Use \`creative_write_email_sequence\` for nurture and conversion email sequences.

8. **Funnel Map** — Use \`funnel_build_map\` to create the complete implementation spec.

9. **Implementation Checklist** — Use \`funnel_assemble\` for the step-by-step launch checklist.

Optimize everything for the lowest possible CAC and fastest CAC liquidation. Do NOT optimize for vanity metrics (CPC, CPM). Focus on customer acquisition cost, revenue per customer, and speed to recoup ad spend.`,
        },
      },
    ],
  }),
);

server.prompt(
  "ad_performance_review",
  "Run a complete ad performance review: CAC trends, creative performance, audience analysis, and recommendations",
  {
    averageLtv: z.string().optional().describe("Average customer LTV in dollars"),
    averageOrderValue: z.string().optional().describe("Average order value in dollars"),
  },
  ({ averageLtv, averageOrderValue }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Run a complete ad performance review. Focus on metrics that matter — CAC, ROAS, LTV. Ignore vanity metrics.

${averageLtv ? `**Average LTV:** $${averageLtv}` : ""}
${averageOrderValue ? `**Average Order Value:** $${averageOrderValue}` : ""}

Execute these reports in sequence:

1. **Weekly Summary** — Use \`report_weekly_ad_summary\` for the executive overview with WoW trends.

2. **Funnel Performance** — Use \`report_funnel_performance\` at the campaign level for last 30 days. Include CAC:LTV ratio and liquidation analysis.

3. **Creative Performance** — Use \`report_creative_performance\` to identify winning and losing ads ranked by CAC.

4. **Audience Performance** — Use \`report_audience_performance\` to find which targeting produces the best CAC.

5. **CAC Trend** — Use \`report_cac_trend\` for the last 30 days daily to see if CAC is trending up or down.

After all reports, provide:
- **Top 3 actions** to reduce CAC
- **Scaling recommendations** for winning campaigns/creatives
- **Kill list** of underperforming ads/audiences to pause
- **Creative refresh** recommendations for fatigued ads`,
        },
      },
    ],
  }),
);

server.prompt(
  "creative_sprint",
  "Generate a batch of new ad creatives: hooks, copy, and Canva designs for testing",
  {
    offer: z.string().describe("What you're selling"),
    avatar: z.string().describe("Target customer"),
    winningAngles: z.string().optional().describe("Current winning angles/hooks to iterate on"),
  },
  ({ offer, avatar, winningAngles }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Run a creative sprint to produce fresh ad assets for testing.

**Offer:** ${offer}
**Avatar:** ${avatar}
${winningAngles ? `**Current Winners to Iterate On:** ${winningAngles}` : ""}

Execute:

1. **Hook Generation** — Use \`creative_generate_hooks\` to generate 15 new hooks (mix all types: pattern interrupt, curiosity, pain, benefit, story, social proof).

2. **Ad Copy Variants** — Use \`creative_write_ad_copy\` to write 5 ad copy variants for Meta. Use PAS, AIDA, and storytelling frameworks. Include at least 2 variants in the "casual/provocative" tone.

3. **Testing Strategy** — Use \`creative_testing_strategy\` to design the creative test plan for these new assets.

4. **Canva Templates** — Use \`canva_list_brand_templates\` to find ad templates, then use \`canva_create_from_template\` to create designs with the new copy.

5. **Headlines** — Use \`landing_generate_headlines\` for 10 headline variants to test on landing pages.

Output all assets organized by test priority. First to test = hooks, then body copy, then visuals.`,
        },
      },
    ],
  }),
);

// ── Register all tools ────────────────────────────────────

// Operations
registerKarbonTools(server);
registerOutlookTools(server);
registerReportingTools(server);

// Ad Funnel Agent
registerMetaAdsTools(server);
registerCanvaTools(server);
registerCreativeTools(server);
registerLandingPageTools(server);
registerFunnelTools(server);
registerAdReportingTools(server);

// ── Start ─────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Executive Assistant + Ad Funnel Agent MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
