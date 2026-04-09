# Executive Assistant MCP Server

An MCP (Model Context Protocol) server that gives Claude skills to manage your
work through **Karbon**, **Microsoft Outlook**, and **HubSpot**, plus generate
operational reports and migrate data between systems.

## Architecture

```
src/
├── index.ts              # MCP server entry point + prompt templates
├── config.ts             # Environment-based configuration
├── http.ts               # Lightweight fetch wrappers
├── karbon/
│   ├── client.ts         # Karbon API client (contacts, orgs, work items, tasks, notes, time)
│   └── tools.ts          # MCP tool definitions for Karbon
├── hubspot/
│   ├── client.ts         # HubSpot CRM API client (contacts, companies, deals, associations)
│   └── tools.ts          # MCP tool definitions for HubSpot
├── migration/
│   └── tools.ts          # Karbon → HubSpot migration with lifecycle tagging
├── outlook/
│   ├── client.ts         # Microsoft Graph API client (email, calendar)
│   └── tools.ts          # MCP tool definitions for Outlook
└── reporting/
    └── tools.ts          # Composite reporting tools (daily briefing, workload, deadlines)
```

## Available Tools (58 total)

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

### HubSpot (16 tools)
- `hubspot_search_contacts` / `hubspot_get_contact` / `hubspot_list_contacts`
- `hubspot_create_contact` / `hubspot_update_contact` / `hubspot_delete_contact`
- `hubspot_search_companies` / `hubspot_create_company` / `hubspot_update_company`
- `hubspot_search_deals` / `hubspot_create_deal` / `hubspot_update_deal`
- `hubspot_associate_contact_company` / `hubspot_associate_deal_contact` / `hubspot_associate_deal_company`

### Migration — Karbon → HubSpot (3 tools)
- `migrate_karbon_to_hubspot` — Full migration with lifecycle tagging (supports dry run)
- `preview_lifecycle_tags` — Preview lifecycle stage assignments without migrating
- `migrate_karbon_contact_to_hubspot` — Migrate a single contact with lifecycle tagging

### Operational Reporting (6 tools)
- `report_daily_briefing` — Calendar + emails + overdue work items
- `report_work_status_summary` — Work items grouped by status
- `report_team_workload` — Distribution across team members
- `report_time_tracking` — Hours by person and work item
- `report_email_summary` — Inbox stats, top senders, high-priority items
- `report_deadlines` — Overdue and upcoming deadlines

### Prompt Templates (4)
- `daily_standup` — Morning routine: calendar, inbox triage, overdue items
- `weekly_ops_report` — Full weekly operational report
- `email_triage` — Categorize inbox and suggest actions
- `client_status_check` — Deep-dive on a specific client's work

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

### HubSpot Credentials
1. Go to **HubSpot → Settings → Integrations → Private Apps**
2. Create a new private app with scopes: `crm.objects.contacts.write`,
   `crm.objects.contacts.read`, `crm.objects.companies.write`,
   `crm.objects.companies.read`, `crm.objects.deals.write`, `crm.objects.deals.read`
3. Copy the access token to `.env`

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
        "HUBSPOT_ACCESS_TOKEN": "..."
      }
    }
  }
}
```

Then ask Claude things like:
- "Run my daily standup"
- "Show me all overdue work items"
- "Search my inbox for emails from John about the tax return"
- "Create a work item for Smith Corp Q4 tax prep"
- "Send an email to jane@example.com about the meeting tomorrow"
- "Give me a team workload report"
- "What deadlines do I have this week?"
- "Preview lifecycle tags for my Karbon contacts"
- "Migrate all Karbon data to HubSpot (dry run first)"
- "Migrate contact John Smith to HubSpot"
- "Create a company in HubSpot for Acme Corp as a customer"
