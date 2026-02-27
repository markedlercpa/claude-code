/**
 * MCP tools for intelligent ad funnel reporting.
 *
 * Focused on the metrics that ACTUALLY matter:
 * - CAC (Customer Acquisition Cost)
 * - CAC Liquidation Speed (how fast you recoup ad spend)
 * - CAC:LTV ratio
 * - ROAS by cohort
 *
 * Intentionally ignores vanity metrics (CPC, CPM, CTR)
 * unless they're diagnostic for a specific problem.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as meta from "../meta/client.js";

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });

// ── Helper: Extract action values from Meta insights ─────

interface MetaAction {
  action_type: string;
  value: string;
}

interface InsightRow {
  date_start?: string;
  date_stop?: string;
  campaign_name?: string;
  adset_name?: string;
  ad_name?: string;
  campaign_id?: string;
  adset_id?: string;
  ad_id?: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  frequency?: string;
  actions?: MetaAction[];
  cost_per_action_type?: MetaAction[];
  action_values?: MetaAction[];
  purchase_roas?: MetaAction[];
  conversions?: MetaAction[];
}

function extractAction(actions: MetaAction[] | undefined, actionType: string): number {
  if (!actions) return 0;
  const match = actions.find((a) => a.action_type === actionType);
  return match ? parseFloat(match.value) : 0;
}

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDollars(dollars: number): string {
  return `$${dollars.toFixed(2)}`;
}

function safeDiv(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

export function registerAdReportingTools(server: McpServer) {
  // ── Funnel Performance Report ────────────────────────────

  server.tool(
    "report_funnel_performance",
    "Generate a comprehensive funnel performance report focused on CAC, ROAS, and revenue metrics. No vanity metrics — only what drives profitability.",
    {
      datePreset: z.string().optional().describe("e.g. last_7d, last_30d, this_month"),
      since: z.string().optional().describe("Start date YYYY-MM-DD"),
      until: z.string().optional().describe("End date YYYY-MM-DD"),
      level: z.enum(["account", "campaign", "adset", "ad"]).optional().describe("Breakdown level (default: campaign)"),
      purchaseEventName: z.string().optional().describe("Custom purchase event name if not standard 'purchase'"),
      leadEventName: z.string().optional().describe("Custom lead event name if not standard 'lead'"),
      averageOrderValue: z.number().optional().describe("Average order value in dollars (for CAC liquidation analysis)"),
      averageLtv: z.number().optional().describe("Average customer LTV in dollars (for CAC:LTV ratio)"),
    },
    async (params) => {
      const purchaseEvent = params.purchaseEventName ?? "purchase";
      const leadEvent = params.leadEventName ?? "lead";
      const reportLevel = params.level ?? "campaign";

      const res = await meta.getAccountInsights({
        date_preset: params.datePreset,
        time_range: params.since && params.until ? { since: params.since, until: params.until } : undefined,
        level: reportLevel,
        fields: [
          "campaign_name", "adset_name", "ad_name",
          "campaign_id", "adset_id", "ad_id",
          "spend", "impressions", "reach", "frequency",
          "actions", "cost_per_action_type",
          "action_values", "purchase_roas", "conversions",
        ].join(","),
      });

      if (!res.ok) {
        return text(`Error fetching insights: ${res.status} — ${JSON.stringify(res.data)}`);
      }

      const rows = ((res.data as { data?: InsightRow[] }).data ?? []) as InsightRow[];

      if (rows.length === 0) {
        return text("No data found for the specified period. Check your date range and ensure campaigns have delivered.");
      }

      const sections: string[] = [
        `# Funnel Performance Report`,
        `**Period:** ${params.since ?? params.datePreset ?? "default"}${params.until ? ` to ${params.until}` : ""}`,
        `**Level:** ${reportLevel}`,
        ``,
      ];

      // ── Account-level summary ──
      let totalSpend = 0;
      let totalPurchases = 0;
      let totalLeads = 0;
      let totalRevenue = 0;
      let totalReach = 0;

      for (const row of rows) {
        totalSpend += parseFloat(row.spend ?? "0");
        totalPurchases += extractAction(row.actions, purchaseEvent);
        totalLeads += extractAction(row.actions, leadEvent);
        totalRevenue += extractAction(row.action_values, purchaseEvent);
        totalReach += parseFloat(row.reach ?? "0");
      }

      const accountCac = safeDiv(totalSpend, totalPurchases);
      const accountCpl = safeDiv(totalSpend, totalLeads);
      const leadToCustomerRate = safeDiv(totalPurchases, totalLeads) * 100;
      const accountRoas = safeDiv(totalRevenue, totalSpend);

      sections.push(`## Account Summary`);
      sections.push(`| Metric | Value |`);
      sections.push(`|--------|-------|`);
      sections.push(`| Total Spend | ${formatDollars(totalSpend)} |`);
      sections.push(`| Total Purchases | ${totalPurchases} |`);
      sections.push(`| Total Leads | ${totalLeads} |`);
      sections.push(`| Total Revenue (Attributed) | ${formatDollars(totalRevenue)} |`);
      sections.push(`| **CAC** | **${formatDollars(accountCac)}** |`);
      sections.push(`| Cost Per Lead | ${formatDollars(accountCpl)} |`);
      sections.push(`| Lead → Customer Rate | ${leadToCustomerRate.toFixed(1)}% |`);
      sections.push(`| ROAS | ${accountRoas.toFixed(2)}x |`);
      sections.push(`| Unique Reach | ${totalReach.toLocaleString()} |`);

      if (params.averageLtv) {
        const cacLtvRatio = safeDiv(accountCac, params.averageLtv);
        const ltvMultiple = safeDiv(params.averageLtv, accountCac);
        sections.push(`| **CAC:LTV Ratio** | **1:${ltvMultiple.toFixed(1)}** |`);
        sections.push(`| LTV | ${formatDollars(params.averageLtv)} |`);

        if (ltvMultiple >= 3) {
          sections.push(`\n> **HEALTHY** — CAC:LTV of 1:${ltvMultiple.toFixed(1)} is above the 1:3 target. Room to scale.`);
        } else if (ltvMultiple >= 2) {
          sections.push(`\n> **WATCH** — CAC:LTV of 1:${ltvMultiple.toFixed(1)} is below the 1:3 target. Optimize before scaling.`);
        } else {
          sections.push(`\n> **WARNING** — CAC:LTV of 1:${ltvMultiple.toFixed(1)} is unsustainable. Reduce CAC or increase LTV urgently.`);
        }
      }

      if (params.averageOrderValue) {
        const ordersToLiquidate = Math.ceil(safeDiv(accountCac, params.averageOrderValue));
        sections.push(`\n### CAC Liquidation Analysis`);
        sections.push(`| Metric | Value |`);
        sections.push(`|--------|-------|`);
        sections.push(`| CAC | ${formatDollars(accountCac)} |`);
        sections.push(`| Average Order Value | ${formatDollars(params.averageOrderValue)} |`);
        sections.push(`| Orders to Liquidate CAC | ${ordersToLiquidate} |`);

        if (accountCac <= params.averageOrderValue) {
          sections.push(`| **Status** | **Self-liquidating on first purchase** |`);
        } else {
          sections.push(`| **Status** | Needs ${ordersToLiquidate} orders to recoup CAC |`);
        }
      }

      // ── Per-entity breakdown ──
      sections.push(`\n## Breakdown by ${reportLevel.charAt(0).toUpperCase() + reportLevel.slice(1)}`);
      sections.push(``);

      const sortedRows = [...rows].sort(
        (a, b) => parseFloat(b.spend ?? "0") - parseFloat(a.spend ?? "0"),
      );

      for (const row of sortedRows) {
        const name =
          row.campaign_name ?? row.adset_name ?? row.ad_name ?? "Unknown";
        const spend = parseFloat(row.spend ?? "0");
        const purchases = extractAction(row.actions, purchaseEvent);
        const leads = extractAction(row.actions, leadEvent);
        const revenue = extractAction(row.action_values, purchaseEvent);
        const cac = safeDiv(spend, purchases);
        const cpl = safeDiv(spend, leads);
        const roas = safeDiv(revenue, spend);
        const l2c = safeDiv(purchases, leads) * 100;
        const freq = parseFloat(row.frequency ?? "0");

        sections.push(`### ${name}`);
        sections.push(`| Metric | Value |`);
        sections.push(`|--------|-------|`);
        sections.push(`| Spend | ${formatDollars(spend)} |`);
        sections.push(`| Purchases | ${purchases} |`);
        sections.push(`| **CAC** | **${formatDollars(cac)}** |`);
        sections.push(`| Leads | ${leads} |`);
        sections.push(`| CPL | ${formatDollars(cpl)} |`);
        sections.push(`| Lead→Customer | ${l2c.toFixed(1)}% |`);
        sections.push(`| Revenue | ${formatDollars(revenue)} |`);
        sections.push(`| ROAS | ${roas.toFixed(2)}x |`);
        sections.push(`| Frequency | ${freq.toFixed(1)} |`);

        // Performance verdict
        if (purchases > 0 && roas >= 2) {
          sections.push(`| Verdict | **SCALE** — Profitable, increase budget |`);
        } else if (purchases > 0 && roas >= 1) {
          sections.push(`| Verdict | **OPTIMIZE** — Breaking even, test new creative |`);
        } else if (spend > 0 && purchases === 0) {
          sections.push(`| Verdict | **REVIEW** — No purchases, check funnel or kill |`);
        } else if (roas < 1) {
          sections.push(`| Verdict | **KILL** — Unprofitable, reallocate budget |`);
        }

        if (freq > 3) {
          sections.push(`| **Alert** | Frequency ${freq.toFixed(1)} — creative fatigue likely, refresh ads |`);
        }

        sections.push(``);
      }

      return text(sections.join("\n"));
    },
  );

  // ── CAC Trend Report ─────────────────────────────────────

  server.tool(
    "report_cac_trend",
    "Track CAC trend over time (daily/weekly) to identify if acquisition cost is improving, stable, or degrading",
    {
      since: z.string().describe("Start date YYYY-MM-DD"),
      until: z.string().describe("End date YYYY-MM-DD"),
      timeIncrement: z.enum(["1", "7", "monthly"]).optional().describe("Granularity: '1'=daily, '7'=weekly, 'monthly' (default daily)"),
      campaignId: z.string().optional().describe("Specific campaign ID to track (omit for account-wide)"),
      purchaseEventName: z.string().optional().describe("Custom purchase event name"),
    },
    async (params) => {
      const purchaseEvent = params.purchaseEventName ?? "purchase";
      const increment = params.timeIncrement ?? "1";

      const insightParams = {
        time_range: { since: params.since, until: params.until },
        time_increment: increment,
        fields: "spend,actions,cost_per_action_type,action_values,purchase_roas,reach,frequency",
      };

      const res = params.campaignId
        ? await meta.getCampaignInsights(params.campaignId, insightParams)
        : await meta.getAccountInsights(insightParams);

      if (!res.ok) {
        return text(`Error: ${res.status} — ${JSON.stringify(res.data)}`);
      }

      const rows = ((res.data as { data?: InsightRow[] }).data ?? []) as InsightRow[];

      if (rows.length === 0) {
        return text("No data for the specified period.");
      }

      const sections: string[] = [
        `# CAC Trend Report`,
        `**Period:** ${params.since} to ${params.until}`,
        `**Granularity:** ${increment === "1" ? "Daily" : increment === "7" ? "Weekly" : "Monthly"}`,
        params.campaignId ? `**Campaign:** ${params.campaignId}` : "**Scope:** Full Account",
        ``,
        `| Period | Spend | Purchases | CAC | Revenue | ROAS | Trend |`,
        `|--------|-------|-----------|-----|---------|------|-------|`,
      ];

      let prevCac = 0;
      const cacValues: number[] = [];

      for (const row of rows) {
        const spend = parseFloat(row.spend ?? "0");
        const purchases = extractAction(row.actions, purchaseEvent);
        const revenue = extractAction(row.action_values, purchaseEvent);
        const cac = safeDiv(spend, purchases);
        const roas = safeDiv(revenue, spend);

        cacValues.push(cac);

        let trend = "—";
        if (prevCac > 0 && cac > 0) {
          const change = ((cac - prevCac) / prevCac) * 100;
          if (change < -5) trend = `↓ ${Math.abs(change).toFixed(0)}% better`;
          else if (change > 5) trend = `↑ ${change.toFixed(0)}% worse`;
          else trend = "→ stable";
        }

        sections.push(
          `| ${row.date_start ?? "?"} | ${formatDollars(spend)} | ${purchases} | ${formatDollars(cac)} | ${formatDollars(revenue)} | ${roas.toFixed(2)}x | ${trend} |`,
        );

        if (cac > 0) prevCac = cac;
      }

      // Summary stats
      const validCacs = cacValues.filter((c) => c > 0);
      if (validCacs.length > 1) {
        const avgCac = validCacs.reduce((a, b) => a + b, 0) / validCacs.length;
        const minCac = Math.min(...validCacs);
        const maxCac = Math.max(...validCacs);
        const firstCac = validCacs[0];
        const lastCac = validCacs[validCacs.length - 1];
        const overallTrend = ((lastCac - firstCac) / firstCac) * 100;

        sections.push(``);
        sections.push(`## Trend Summary`);
        sections.push(`| Metric | Value |`);
        sections.push(`|--------|-------|`);
        sections.push(`| Average CAC | ${formatDollars(avgCac)} |`);
        sections.push(`| Best CAC | ${formatDollars(minCac)} |`);
        sections.push(`| Worst CAC | ${formatDollars(maxCac)} |`);
        sections.push(`| Overall Trend | ${overallTrend > 0 ? `↑ ${overallTrend.toFixed(0)}% worse` : `↓ ${Math.abs(overallTrend).toFixed(0)}% better`} |`);

        if (overallTrend > 20) {
          sections.push(`\n> **ALERT:** CAC is trending significantly upward. Likely causes: creative fatigue, audience saturation, or seasonal shifts. Refresh creatives and test new audiences.`);
        } else if (overallTrend < -20) {
          sections.push(`\n> **POSITIVE:** CAC is trending down significantly. Consider scaling budget while performance is strong.`);
        }
      }

      return text(sections.join("\n"));
    },
  );

  // ── Cohort LTV Analysis ──────────────────────────────────

  server.tool(
    "report_cohort_analysis",
    "Analyze customer cohorts by acquisition month to understand CAC liquidation speed and LTV development over time. Input your revenue data per cohort.",
    {
      cohorts: z.string().describe(`JSON array of cohorts, each with: { "month": "2025-01", "customers": 50, "cac": 45, "revenue_month_0": 97, "revenue_month_1": 30, "revenue_month_2": 20, ... }`),
      targetCac: z.number().optional().describe("Target CAC in dollars"),
      targetLtvRatio: z.number().optional().describe("Target LTV:CAC ratio (default 3)"),
    },
    async (params) => {
      const targetRatio = params.targetLtvRatio ?? 3;

      let cohorts: Array<{
        month: string;
        customers: number;
        cac: number;
        [key: string]: string | number;
      }>;

      try {
        cohorts = JSON.parse(params.cohorts);
      } catch {
        return text("Error: Invalid JSON. Provide an array of cohort objects.");
      }

      const sections: string[] = [
        `# Cohort LTV Analysis`,
        params.targetCac ? `**Target CAC:** ${formatDollars(params.targetCac)}` : "",
        `**Target LTV:CAC Ratio:** ${targetRatio}:1`,
        ``,
      ];

      // Build cohort table
      const revenueMonths = new Set<number>();
      for (const cohort of cohorts) {
        for (const key of Object.keys(cohort)) {
          const match = key.match(/^revenue_month_(\d+)$/);
          if (match) revenueMonths.add(parseInt(match[1]));
        }
      }
      const sortedMonths = [...revenueMonths].sort((a, b) => a - b);

      // Header
      let header = `| Cohort | Customers | CAC | Total Ad Spend |`;
      let separator = `|--------|-----------|-----|----------------|`;
      for (const m of sortedMonths) {
        header += ` M${m} Rev |`;
        separator += `---------|`;
      }
      header += ` Cumulative LTV | LTV:CAC | Liquidation |`;
      separator += `-----------------|---------|-------------|`;

      sections.push(header);
      sections.push(separator);

      for (const cohort of cohorts) {
        let cumRevenue = 0;
        let liquidationMonth = -1;
        const adSpend = cohort.cac * cohort.customers;

        let row = `| ${cohort.month} | ${cohort.customers} | ${formatDollars(cohort.cac)} | ${formatDollars(adSpend)} |`;

        let runningRevPerCustomer = 0;
        for (const m of sortedMonths) {
          const mRev = (cohort[`revenue_month_${m}`] as number) ?? 0;
          runningRevPerCustomer += mRev;
          cumRevenue += mRev * cohort.customers;
          row += ` ${formatDollars(mRev)} |`;

          if (liquidationMonth === -1 && runningRevPerCustomer >= cohort.cac) {
            liquidationMonth = m;
          }
        }

        const ltvPerCustomer = safeDiv(cumRevenue, cohort.customers);
        const ltvCacRatio = safeDiv(ltvPerCustomer, cohort.cac);

        row += ` ${formatDollars(ltvPerCustomer)} |`;
        row += ` 1:${ltvCacRatio.toFixed(1)} |`;
        row += liquidationMonth >= 0
          ? ` Month ${liquidationMonth} |`
          : ` Not yet |`;

        sections.push(row);
      }

      // Summary analysis
      sections.push(``);
      sections.push(`## Analysis`);

      const avgCac = safeDiv(
        cohorts.reduce((s, c) => s + c.cac, 0),
        cohorts.length,
      );

      const avgLiquidation = cohorts
        .map((c) => {
          let running = 0;
          for (const m of sortedMonths) {
            running += (c[`revenue_month_${m}`] as number) ?? 0;
            if (running >= c.cac) return m;
          }
          return -1;
        })
        .filter((m) => m >= 0);

      const avgLiqMonths = avgLiquidation.length > 0
        ? safeDiv(
            avgLiquidation.reduce((a, b) => a + b, 0),
            avgLiquidation.length,
          )
        : -1;

      sections.push(`| Metric | Value |`);
      sections.push(`|--------|-------|`);
      sections.push(`| Average CAC | ${formatDollars(avgCac)} |`);
      sections.push(
        `| Average Liquidation Speed | ${avgLiqMonths >= 0 ? `Month ${avgLiqMonths.toFixed(1)}` : "Not liquidating yet"} |`,
      );

      if (avgLiqMonths >= 0 && avgLiqMonths <= 1) {
        sections.push(`\n> **EXCELLENT:** CAC liquidates within the first month. This is a self-liquidating funnel — scale aggressively.`);
      } else if (avgLiqMonths >= 0 && avgLiqMonths <= 3) {
        sections.push(`\n> **GOOD:** CAC liquidates within ${Math.ceil(avgLiqMonths)} months. Consider front-end offer optimization to accelerate liquidation.`);
      } else if (avgLiqMonths > 3) {
        sections.push(`\n> **SLOW:** CAC takes ${Math.ceil(avgLiqMonths)}+ months to liquidate. Add upsells, order bumps, or tripwires to speed up recovery.`);
      } else {
        sections.push(`\n> **WARNING:** CAC is not liquidating within the measured period. Immediate action needed: reduce CAC or add revenue-generating touchpoints.`);
      }

      // Trend across cohorts
      if (cohorts.length >= 3) {
        const recentCohorts = cohorts.slice(-3);
        const olderCohorts = cohorts.slice(0, 3);
        const recentAvgCac = safeDiv(recentCohorts.reduce((s, c) => s + c.cac, 0), recentCohorts.length);
        const olderAvgCac = safeDiv(olderCohorts.reduce((s, c) => s + c.cac, 0), olderCohorts.length);
        const cacDirection = ((recentAvgCac - olderAvgCac) / olderAvgCac) * 100;

        sections.push(`\n### Cohort Trends`);
        sections.push(`- Recent 3 cohorts avg CAC: ${formatDollars(recentAvgCac)} vs earlier: ${formatDollars(olderAvgCac)}`);
        sections.push(
          `- CAC trend: ${cacDirection > 5 ? `↑ ${cacDirection.toFixed(0)}% increase (getting more expensive)` : cacDirection < -5 ? `↓ ${Math.abs(cacDirection).toFixed(0)}% decrease (improving)` : "→ stable"}`,
        );
      }

      return text(sections.filter(Boolean).join("\n"));
    },
  );

  // ── Creative Performance Report ──────────────────────────

  server.tool(
    "report_creative_performance",
    "Analyze ad creative performance to identify winners and losers. Ranked by CAC, not vanity metrics.",
    {
      campaignId: z.string().optional().describe("Specific campaign to analyze (omit for all)"),
      datePreset: z.string().optional().describe("e.g. last_7d, last_30d"),
      since: z.string().optional().describe("Start date YYYY-MM-DD"),
      until: z.string().optional().describe("End date YYYY-MM-DD"),
      purchaseEventName: z.string().optional().describe("Custom purchase event name"),
      minimumSpend: z.number().optional().describe("Minimum spend threshold to include in analysis (filters noise)"),
    },
    async (params) => {
      const purchaseEvent = params.purchaseEventName ?? "purchase";
      const minSpend = params.minimumSpend ?? 0;

      const insightParams = {
        date_preset: params.datePreset,
        time_range: params.since && params.until ? { since: params.since, until: params.until } : undefined,
        level: "ad" as const,
        fields: "ad_name,ad_id,spend,impressions,actions,cost_per_action_type,action_values,purchase_roas,reach,frequency",
      };

      const res = params.campaignId
        ? await meta.getCampaignInsights(params.campaignId, { ...insightParams, level: "ad" })
        : await meta.getAccountInsights(insightParams);

      if (!res.ok) {
        return text(`Error: ${res.status} — ${JSON.stringify(res.data)}`);
      }

      const allRows = ((res.data as { data?: InsightRow[] }).data ?? []) as InsightRow[];
      const rows = allRows.filter((r) => parseFloat(r.spend ?? "0") >= minSpend);

      if (rows.length === 0) {
        return text(`No ads found with spend >= ${formatDollars(minSpend)} in the specified period.`);
      }

      // Sort by CAC (lowest first = best)
      const analyzed = rows.map((row) => {
        const spend = parseFloat(row.spend ?? "0");
        const purchases = extractAction(row.actions, purchaseEvent);
        const leads = extractAction(row.actions, "lead");
        const revenue = extractAction(row.action_values, purchaseEvent);
        const cac = safeDiv(spend, purchases);
        const roas = safeDiv(revenue, spend);
        const freq = parseFloat(row.frequency ?? "0");

        return {
          name: row.ad_name ?? row.ad_id ?? "Unknown",
          spend, purchases, leads, revenue, cac, roas, freq,
        };
      });

      // Split into performers and non-performers
      const withPurchases = analyzed.filter((a) => a.purchases > 0).sort((a, b) => a.cac - b.cac);
      const withoutPurchases = analyzed.filter((a) => a.purchases === 0).sort((a, b) => b.spend - a.spend);

      const sections: string[] = [
        `# Creative Performance Report`,
        `**Period:** ${params.since ?? params.datePreset ?? "default"}`,
        `**Ads Analyzed:** ${rows.length} (min spend: ${formatDollars(minSpend)})`,
        ``,
      ];

      if (withPurchases.length > 0) {
        sections.push(`## Winners (Ranked by CAC, lowest = best)\n`);
        sections.push(`| Rank | Ad Name | Spend | Purchases | CAC | Revenue | ROAS | Freq |`);
        sections.push(`|------|---------|-------|-----------|-----|---------|------|------|`);

        withPurchases.forEach((ad, i) => {
          const medal = i === 0 ? "***" : i === 1 ? "**" : i === 2 ? "*" : "";
          sections.push(
            `| ${i + 1}${medal} | ${ad.name} | ${formatDollars(ad.spend)} | ${ad.purchases} | ${formatDollars(ad.cac)} | ${formatDollars(ad.revenue)} | ${ad.roas.toFixed(2)}x | ${ad.freq.toFixed(1)} |`,
          );
        });
        sections.push(``);

        // Recommendations
        const bestAd = withPurchases[0];
        const worstPerformer = withPurchases[withPurchases.length - 1];

        sections.push(`### Recommendations`);
        sections.push(`- **Scale:** "${bestAd.name}" — best CAC at ${formatDollars(bestAd.cac)}, ${bestAd.roas.toFixed(2)}x ROAS`);
        if (withPurchases.length > 1) {
          sections.push(`- **Watch:** "${worstPerformer.name}" — worst performing CAC at ${formatDollars(worstPerformer.cac)}`);
        }

        // Fatigue alerts
        const fatigued = withPurchases.filter((a) => a.freq > 3);
        if (fatigued.length > 0) {
          sections.push(`\n### Creative Fatigue Alerts`);
          fatigued.forEach((ad) => {
            sections.push(`- "${ad.name}" — Frequency ${ad.freq.toFixed(1)}. Refresh this creative.`);
          });
        }
      }

      if (withoutPurchases.length > 0) {
        sections.push(`\n## Non-Converting Ads (no purchases, sorted by spend)\n`);
        sections.push(`| Ad Name | Spend | Leads | Freq | Recommendation |`);
        sections.push(`|---------|-------|-------|------|----------------|`);

        withoutPurchases.forEach((ad) => {
          const rec = ad.spend > 100
            ? "**KILL** — significant spend, no conversions"
            : ad.leads > 0
              ? "Monitor — generating leads but no purchases"
              : "Kill — no traction";
          sections.push(
            `| ${ad.name} | ${formatDollars(ad.spend)} | ${ad.leads} | ${ad.freq.toFixed(1)} | ${rec} |`,
          );
        });
      }

      return text(sections.join("\n"));
    },
  );

  // ── Audience Performance Report ──────────────────────────

  server.tool(
    "report_audience_performance",
    "Analyze audience/ad set performance to identify which targeting produces the lowest CAC and highest LTV",
    {
      campaignId: z.string().optional().describe("Specific campaign to analyze"),
      datePreset: z.string().optional().describe("e.g. last_7d, last_30d"),
      since: z.string().optional().describe("Start date YYYY-MM-DD"),
      until: z.string().optional().describe("End date YYYY-MM-DD"),
      purchaseEventName: z.string().optional().describe("Custom purchase event name"),
    },
    async (params) => {
      const purchaseEvent = params.purchaseEventName ?? "purchase";

      const insightParams = {
        date_preset: params.datePreset,
        time_range: params.since && params.until ? { since: params.since, until: params.until } : undefined,
        level: "adset" as const,
        fields: "adset_name,adset_id,spend,actions,cost_per_action_type,action_values,purchase_roas,reach,frequency",
      };

      const res = params.campaignId
        ? await meta.getCampaignInsights(params.campaignId, { ...insightParams, level: "adset" })
        : await meta.getAccountInsights(insightParams);

      if (!res.ok) {
        return text(`Error: ${res.status} — ${JSON.stringify(res.data)}`);
      }

      const rows = ((res.data as { data?: InsightRow[] }).data ?? []) as InsightRow[];

      if (rows.length === 0) {
        return text("No ad set data found for the specified period.");
      }

      const analyzed = rows.map((row) => {
        const spend = parseFloat(row.spend ?? "0");
        const purchases = extractAction(row.actions, purchaseEvent);
        const leads = extractAction(row.actions, "lead");
        const revenue = extractAction(row.action_values, purchaseEvent);
        const cac = safeDiv(spend, purchases);
        const roas = safeDiv(revenue, spend);
        const reach = parseFloat(row.reach ?? "0");
        const freq = parseFloat(row.frequency ?? "0");

        return {
          name: row.adset_name ?? row.adset_id ?? "Unknown",
          spend, purchases, leads, revenue, cac, roas, reach, freq,
        };
      });

      analyzed.sort((a, b) => {
        if (a.purchases > 0 && b.purchases > 0) return a.cac - b.cac;
        if (a.purchases > 0) return -1;
        if (b.purchases > 0) return 1;
        return b.spend - a.spend;
      });

      const sections: string[] = [
        `# Audience Performance Report`,
        `**Period:** ${params.since ?? params.datePreset ?? "default"}`,
        `**Audiences Analyzed:** ${rows.length}`,
        ``,
        `| Audience | Spend | Purchases | CAC | Leads | Revenue | ROAS | Reach | Freq |`,
        `|----------|-------|-----------|-----|-------|---------|------|-------|------|`,
      ];

      for (const aud of analyzed) {
        sections.push(
          `| ${aud.name} | ${formatDollars(aud.spend)} | ${aud.purchases} | ${aud.purchases > 0 ? formatDollars(aud.cac) : "N/A"} | ${aud.leads} | ${formatDollars(aud.revenue)} | ${aud.roas.toFixed(2)}x | ${aud.reach.toLocaleString()} | ${aud.freq.toFixed(1)} |`,
        );
      }

      // Saturation analysis
      const saturated = analyzed.filter((a) => a.freq > 3 && a.reach > 0);
      if (saturated.length > 0) {
        sections.push(`\n## Audience Saturation Alerts`);
        saturated.forEach((aud) => {
          sections.push(`- **${aud.name}**: Frequency ${aud.freq.toFixed(1)} with ${aud.reach.toLocaleString()} reach. Consider expanding targeting or refreshing creative.`);
        });
      }

      // Scaling recommendations
      const profitable = analyzed.filter((a) => a.purchases > 0 && a.roas >= 1.5);
      if (profitable.length > 0) {
        sections.push(`\n## Scaling Candidates`);
        profitable.forEach((aud) => {
          sections.push(`- **${aud.name}**: CAC ${formatDollars(aud.cac)}, ${aud.roas.toFixed(2)}x ROAS. ${aud.freq < 2 ? "Low frequency — room to scale." : "Watch frequency."}`);
        });
      }

      return text(sections.join("\n"));
    },
  );

  // ── Weekly Executive Summary ─────────────────────────────

  server.tool(
    "report_weekly_ad_summary",
    "Generate a weekly executive summary of ad performance optimized for decision-making. Shows WoW trends in CAC, revenue, and funnel efficiency.",
    {
      averageLtv: z.number().optional().describe("Average customer LTV for ratio calculations"),
      averageOrderValue: z.number().optional().describe("Average order value for liquidation analysis"),
      purchaseEventName: z.string().optional().describe("Custom purchase event name"),
    },
    async (params) => {
      const purchaseEvent = params.purchaseEventName ?? "purchase";

      // Fetch this week and last week
      const [thisWeekRes, lastWeekRes] = await Promise.allSettled([
        meta.getAccountInsights({
          date_preset: "last_7d",
          fields: "spend,actions,cost_per_action_type,action_values,purchase_roas,reach,frequency",
        }),
        meta.getAccountInsights({
          date_preset: "last_14d",
          fields: "spend,actions,cost_per_action_type,action_values,purchase_roas,reach,frequency",
        }),
      ]);

      const sections: string[] = [
        `# Weekly Ad Performance Summary`,
        `**Generated:** ${new Date().toISOString().split("T")[0]}`,
        ``,
      ];

      if (thisWeekRes.status !== "fulfilled" || !thisWeekRes.value.ok) {
        return text("Error: Could not fetch this week's data from Meta.");
      }

      const thisWeekRows = ((thisWeekRes.value.data as { data?: InsightRow[] }).data ?? []) as InsightRow[];
      const tw = thisWeekRows[0];

      if (!tw) {
        return text("No data available for this week.");
      }

      const twSpend = parseFloat(tw.spend ?? "0");
      const twPurchases = extractAction(tw.actions, purchaseEvent);
      const twLeads = extractAction(tw.actions, "lead");
      const twRevenue = extractAction(tw.action_values, purchaseEvent);
      const twCac = safeDiv(twSpend, twPurchases);
      const twRoas = safeDiv(twRevenue, twSpend);

      sections.push(`## This Week`);
      sections.push(`| Metric | Value |`);
      sections.push(`|--------|-------|`);
      sections.push(`| Ad Spend | ${formatDollars(twSpend)} |`);
      sections.push(`| New Customers | ${twPurchases} |`);
      sections.push(`| New Leads | ${twLeads} |`);
      sections.push(`| **CAC** | **${formatDollars(twCac)}** |`);
      sections.push(`| Revenue (Ad-Attributed) | ${formatDollars(twRevenue)} |`);
      sections.push(`| ROAS | ${twRoas.toFixed(2)}x |`);

      if (params.averageLtv) {
        const ratio = safeDiv(params.averageLtv, twCac);
        sections.push(`| CAC:LTV | 1:${ratio.toFixed(1)} |`);
      }

      if (params.averageOrderValue) {
        const liquidates = twCac <= params.averageOrderValue;
        sections.push(`| Liquidation | ${liquidates ? "Self-liquidating on first purchase" : `Needs ${Math.ceil(safeDiv(twCac, params.averageOrderValue))} orders`} |`);
      }

      // WoW comparison if available
      if (lastWeekRes.status === "fulfilled" && lastWeekRes.value.ok) {
        const lastWeekRows = ((lastWeekRes.value.data as { data?: InsightRow[] }).data ?? []) as InsightRow[];
        const lw = lastWeekRows[0];

        if (lw) {
          const lwSpend = parseFloat(lw.spend ?? "0") - twSpend; // last_14d includes this week
          const lwPurchases = extractAction(lw.actions, purchaseEvent) - twPurchases;
          const lwRevenue = extractAction(lw.action_values, purchaseEvent) - twRevenue;
          const lwCac = safeDiv(lwSpend, lwPurchases);
          const lwRoas = safeDiv(lwRevenue, lwSpend);

          if (lwSpend > 0) {
            const cacChange = safeDiv(twCac - lwCac, lwCac) * 100;
            const roasChange = safeDiv(twRoas - lwRoas, lwRoas) * 100;
            const spendChange = safeDiv(twSpend - lwSpend, lwSpend) * 100;

            sections.push(`\n## Week-over-Week`);
            sections.push(`| Metric | Last Week | This Week | Change |`);
            sections.push(`|--------|-----------|-----------|--------|`);
            sections.push(`| Spend | ${formatDollars(lwSpend)} | ${formatDollars(twSpend)} | ${spendChange > 0 ? "+" : ""}${spendChange.toFixed(0)}% |`);
            sections.push(`| CAC | ${formatDollars(lwCac)} | ${formatDollars(twCac)} | ${cacChange > 0 ? `+${cacChange.toFixed(0)}% worse` : `${cacChange.toFixed(0)}% better`} |`);
            sections.push(`| ROAS | ${lwRoas.toFixed(2)}x | ${twRoas.toFixed(2)}x | ${roasChange > 0 ? "+" : ""}${roasChange.toFixed(0)}% |`);
            sections.push(`| Purchases | ${lwPurchases} | ${twPurchases} | ${twPurchases - lwPurchases > 0 ? "+" : ""}${twPurchases - lwPurchases} |`);
          }
        }
      }

      // Action items
      sections.push(`\n## Recommended Actions`);
      if (twRoas >= 2) {
        sections.push(`1. **Scale:** ROAS is healthy at ${twRoas.toFixed(2)}x. Increase daily budget by 20%.`);
      } else if (twRoas >= 1) {
        sections.push(`1. **Optimize:** ROAS is at break-even (${twRoas.toFixed(2)}x). Focus on creative testing and landing page optimization.`);
      } else {
        sections.push(`1. **Reduce:** ROAS below 1x (${twRoas.toFixed(2)}x). Pause underperformers immediately and audit funnel.`);
      }

      sections.push(`2. Review creative performance: run \`report_creative_performance\` to identify winners and losers.`);
      sections.push(`3. Check audience saturation: run \`report_audience_performance\` for frequency alerts.`);

      return text(sections.join("\n"));
    },
  );
}
