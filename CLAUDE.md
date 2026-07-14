# Executive Assistant MCP Server

An MCP (Model Context Protocol) server that gives Claude skills to manage your
work through **Karbon** and **Microsoft Outlook**, plus generate operational
reports for your firm.

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
│   └── tools.ts          # Composite reporting tools (daily briefing, workload, deadlines)
└── raven/                # LAPS Sales Coordinator agent (see docs/raven.md)
    ├── graph.ts          # Graph *application*-auth client scoped to the shared mailbox
    ├── persona.ts        # Verbatim system prompt + disclosure/escalation constants
    ├── classifier.ts     # Deterministic message classification → routing
    ├── attribution.ts    # HubSpot deal-owner lookup + configurable fallback
    ├── disclosure.ts     # On-behalf-of footer, never-impersonate + pricing guards
    ├── hitl.ts           # Human-in-the-loop gate (pluggable approver)
    ├── logging.ts        # JSONL audit trail
    └── tools.ts          # MCP tool definitions for Raven
```

## Available Tools (45 total)

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

### Raven — LAPS Sales Coordinator (7 tools)
See `docs/raven.md` for setup and the mandatory M365 provisioning steps.
- `raven_get_persona`
- `raven_list_inbox` / `raven_get_message`
- `raven_classify_message` / `raven_resolve_owner`
- `raven_compose_email` / `raven_handle_email`

### Prompt Templates (5)
- `daily_standup` — Morning routine: calendar, inbox triage, overdue items
- `weekly_ops_report` — Full weekly operational report
- `email_triage` — Categorize inbox and suggest actions
- `client_status_check` — Deep-dive on a specific client's work
- `raven_handle_lead` — Raven triages an inbound prospect email and routes it

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
        "MICROSOFT_REFRESH_TOKEN": "..."
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
