# Executive Assistant + Ad Funnel Agent MCP Server

An MCP (Model Context Protocol) server that gives Claude skills to manage your
work through **Karbon** and **Microsoft Outlook**, generate operational
reports, AND operate as a **fully autonomous ad funnel builder** with Meta Ads,
Canva creative production, landing page generation, and intelligent CAC/LTV
reporting.

## Architecture

```
src/
├── index.ts              # MCP server entry point + prompt templates
├── config.ts             # Environment-based configuration
├── http.ts               # Lightweight fetch wrappers
├── karbon/
│   ├── client.ts         # Karbon API client (contacts, orgs, work items, tasks, notes, time)
│   └── tools.ts          # MCP tool definitions for Karbon
├── outlook/
│   ├── client.ts         # Microsoft Graph API client (email, calendar)
│   └── tools.ts          # MCP tool definitions for Outlook
├── reporting/
│   └── tools.ts          # Composite operational reporting tools
├── meta/
│   ├── client.ts         # Meta Marketing API client (campaigns, ad sets, ads, creatives, audiences, insights)
│   └── tools.ts          # MCP tool definitions for Meta Ads
├── canva/
│   ├── client.ts         # Canva Connect API client (designs, templates, exports, assets)
│   └── tools.ts          # MCP tool definitions for Canva
├── creative/
│   └── tools.ts          # AI creative engine (hooks, ad copy, VSL scripts, email sequences, offers, urgency campaigns)
├── landing/
│   └── tools.ts          # Landing page copy generator, headline generator, page auditor
├── funnel/
│   └── tools.ts          # Funnel strategy, funnel mapping, A/B test planning, funnel assembly
└── ad-reporting/
    └── tools.ts          # Intelligent ad reporting (CAC trends, cohort LTV, creative performance, audience analysis)
```

## Available Tools (88+ total)

### Karbon (18 tools)
- `karbon_search_contacts` / `karbon_get_contact` / `karbon_list_contacts`
- `karbon_list_organizations` / `karbon_get_organization`
- `karbon_list_work_items` / `karbon_get_work_item` / `karbon_create_work_item` / `karbon_update_work_item`
- `karbon_list_work_item_statuses`
- `karbon_list_tasks` / `karbon_create_task` / `karbon_update_task`
- `karbon_list_notes` / `karbon_add_note`
- `karbon_list_time_entries` / `karbon_create_time_entry`
- `karbon_list_users`

### Outlook (12 tools)
- `outlook_list_emails` / `outlook_get_email` / `outlook_send_email`
- `outlook_reply_to_email` / `outlook_forward_email`
- `outlook_update_email` / `outlook_move_email` / `outlook_delete_email`
- `outlook_list_folders`
- `outlook_list_calendar_events` / `outlook_create_calendar_event` / `outlook_delete_calendar_event`

### Operational Reporting (6 tools)
- `report_daily_briefing` — Calendar + emails + overdue work items
- `report_work_status_summary` — Work items grouped by status
- `report_team_workload` — Distribution across team members
- `report_time_tracking` — Hours by person and work item
- `report_email_summary` — Inbox stats, top senders, high-priority items
- `report_deadlines` — Overdue and upcoming deadlines

### Meta Ads (22 tools)
- **Campaigns:** `meta_list_campaigns` / `meta_get_campaign` / `meta_create_campaign` / `meta_update_campaign`
- **Ad Sets:** `meta_list_adsets` / `meta_get_adset` / `meta_create_adset` / `meta_update_adset`
- **Ads:** `meta_list_ads` / `meta_create_ad` / `meta_update_ad`
- **Creatives:** `meta_list_creatives` / `meta_create_creative`
- **Audiences:** `meta_list_audiences` / `meta_create_audience` / `meta_create_lookalike`
- **Insights:** `meta_account_insights` / `meta_campaign_insights` / `meta_adset_insights` / `meta_ad_insights`
- **Tracking:** `meta_list_pixels` / `meta_pixel_stats`

### Canva (10 tools)
- **Designs:** `canva_list_designs` / `canva_get_design` / `canva_create_design`
- **Templates:** `canva_list_brand_templates` / `canva_get_brand_template` / `canva_create_from_template` / `canva_check_autofill`
- **Exports:** `canva_export_design` / `canva_check_export`
- **Assets:** `canva_upload_asset`
- **Organization:** `canva_create_folder`

### Creative Engine (7 tools)
- `creative_generate_hooks` — Generate scroll-stopping hooks (pattern interrupt, curiosity, pain, benefit, social proof, controversy, story, statistic, question, bold claim)
- `creative_write_ad_copy` — Write platform-specific ad copy using AIDA, PAS, BAB, QUEST, 4Ps, storytelling frameworks
- `creative_write_vsl_script` — Write complete VSL scripts (3min to 45min webinar)
- `creative_write_email_sequence` — Write conversion email sequences (welcome, launch, cart abandon, post-purchase, webinar followup, reengagement)
- `creative_design_offer` — Design offer stacks with bonuses, guarantees, urgency/scarcity, price anchoring
- `creative_urgency_campaign` — Design multi-channel urgency/scarcity campaigns
- `creative_testing_strategy` — Design systematic creative testing plans

### Landing Pages (3 tools)
- `landing_generate_page` — Generate complete landing page copy (opt-in, sales, webinar, VSL, thank you, order form, upsell, application, waitlist)
- `landing_generate_headlines` — Generate high-converting headlines using proven formulas
- `landing_audit_page` — Audit landing page copy against direct response best practices

### Funnel Orchestration (4 tools)
- `funnel_design_strategy` — Design complete funnel strategy for any business model
- `funnel_build_map` — Create detailed funnel maps with every page, email, ad, and automation
- `funnel_ab_test_plan` — Design prioritized A/B testing roadmaps with ICE scoring
- `funnel_assemble` — Full funnel assembly coordination with implementation checklist

### Ad Performance Reporting (5 tools)
- `report_funnel_performance` — Comprehensive funnel report: CAC, ROAS, CAC:LTV ratio, liquidation analysis. **No vanity metrics.**
- `report_cac_trend` — Daily/weekly CAC trend tracking with alerts
- `report_cohort_analysis` — Cohort LTV analysis with liquidation speed per cohort
- `report_creative_performance` — Creative ranking by CAC (not CPM/CPC), fatigue alerts, scale/kill recommendations
- `report_audience_performance` — Audience ranking by CAC, saturation alerts, scaling candidates
- `report_weekly_ad_summary` — Executive weekly summary with WoW comparison and action items

### Prompt Templates (7)
- `daily_standup` — Morning routine: calendar, inbox triage, overdue items
- `weekly_ops_report` — Full weekly operational report
- `email_triage` — Categorize inbox and suggest actions
- `client_status_check` — Deep-dive on a specific client's work
- `build_ad_funnel` — **Full funnel build**: strategy, offer, hooks, copy, VSL, pages, emails, map, launch
- `ad_performance_review` — **Complete ad audit**: weekly summary, funnel performance, creative ranking, audience analysis, CAC trends
- `creative_sprint` — **Creative batch**: generate hooks, copy, designs, and testing plan

## Key Reporting Philosophy

This agent optimizes for metrics that drive profitability:

| Track This | Not This |
|------------|----------|
| **CAC** (Customer Acquisition Cost) | CPC (Cost Per Click) |
| **CAC:LTV Ratio** (target 1:3+) | CPM (Cost Per 1000 Impressions) |
| **CAC Liquidation Speed** (days to recoup) | CTR (Click-Through Rate) |
| **ROAS** (Return on Ad Spend) | Impressions |
| **Revenue per Customer** | Reach |
| **Cohort LTV** (30/60/90 day) | Engagement Rate |

## Setup

1. `npm install`
2. Copy `.env.example` → `.env` and fill in credentials
3. `npm run build` to compile, or `npm run dev` to run directly

### Karbon Credentials
Go to **Karbon → Settings → Connected Apps → API Keys** to generate your
Access Key and Bearer Token.

### Microsoft / Outlook Credentials
1. Register an app at **Azure Portal → App registrations**
2. Add redirect URI: `http://localhost:3000/callback` (or your preference)
3. API Permissions: `Mail.ReadWrite`, `Mail.Send`, `Calendars.ReadWrite`, `offline_access`
4. Complete the OAuth flow to obtain access + refresh tokens
5. Add Client ID, Client Secret, Tenant ID, and tokens to `.env`

### Meta (Facebook) Ads Credentials
1. Create an app at **developers.facebook.com/apps/**
2. Add the **Marketing API** product
3. Generate a long-lived access token via **Marketing API → Tools → Access Token Tool**
4. Required permissions: `ads_management`, `ads_read`, `pages_read_engagement`
5. Add your Ad Account ID (numeric, no `act_` prefix), Pixel ID, and Page ID to `.env`

### Canva Credentials
1. Create an integration at **canva.com/developers/**
2. Required scopes: `design:content:read`, `design:content:write`, `asset:read`, `asset:write`, `brandtemplate:content:read`, `folder:read`, `folder:write`
3. Complete the OAuth flow and add the access token to `.env`

## Usage with Claude Code

Add to your `.mcp.json`:
```json
{
  "mcpServers": {
    "executive-assistant": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "/path/to/this/project",
      "env": {
        "KARBON_ACCESS_KEY": "...",
        "KARBON_BEARER_TOKEN": "...",
        "MICROSOFT_CLIENT_ID": "...",
        "MICROSOFT_CLIENT_SECRET": "...",
        "MICROSOFT_TENANT_ID": "...",
        "MICROSOFT_ACCESS_TOKEN": "...",
        "MICROSOFT_REFRESH_TOKEN": "...",
        "META_ACCESS_TOKEN": "...",
        "META_AD_ACCOUNT_ID": "...",
        "META_PIXEL_ID": "...",
        "META_PAGE_ID": "...",
        "CANVA_ACCESS_TOKEN": "..."
      }
    }
  }
}
```

### Operations Examples
- "Run my daily standup"
- "Show me all overdue work items"
- "Send an email to jane@example.com about the meeting tomorrow"
- "Give me a team workload report"

### Ad Funnel Examples
- "Build me an ad funnel for my $997 online course targeting first-time entrepreneurs"
- "Generate 10 hooks for my SaaS product targeting agency owners"
- "Write a VSL script for my coaching program"
- "Create a landing page for my webinar registration"
- "Run my ad performance review — my LTV is $300 and AOV is $97"
- "Show me my CAC trend for the last 30 days"
- "Which ads should I kill and which should I scale?"
- "Design an offer stack for my membership at $47/month"
- "Create a cart-close urgency campaign for the next 72 hours"
- "Run a creative sprint — I need fresh ad assets for testing"
