import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as karbon from "./client.js";

export function registerKarbonTools(server: McpServer) {
  // ── Contacts ────────────────────────────────────────────

  server.tool(
    "karbon_search_contacts",
    "Search for contacts in Karbon by name",
    { search: z.string().describe("Name or partial name to search for") },
    async ({ search }) => {
      const res = await karbon.searchContacts(search);
      if (!res.ok) return { content: [{ type: "text" as const, text: `Error ${res.status}: ${JSON.stringify(res.data)}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(res.data, null, 2) }] };
    },
  );

  server.tool(
    "karbon_get_contact",
    "Get a specific contact's details by their ContactKey",
    { contactKey: z.string().describe("The unique key of the contact") },
    async ({ contactKey }) => {
      const res = await karbon.getContact(contactKey);
      if (!res.ok) return { content: [{ type: "text" as const, text: `Error ${res.status}: ${JSON.stringify(res.data)}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(res.data, null, 2) }] };
    },
  );

  server.tool(
    "karbon_list_contacts",
    "List contacts in Karbon with an optional OData filter",
    { filter: z.string().optional().describe("OData $filter expression (e.g. \"EmailAddress eq 'john@example.com'\")") },
    async ({ filter }) => {
      const res = await karbon.listContacts(filter);
      if (!res.ok) return { content: [{ type: "text" as const, text: `Error ${res.status}: ${JSON.stringify(res.data)}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(res.data, null, 2) }] };
    },
  );

  // ── Organizations ───────────────────────────────────────

  server.tool(
    "karbon_list_organizations",
    "List organizations in Karbon with an optional filter",
    { filter: z.string().optional().describe("OData $filter expression") },
    async ({ filter }) => {
      const res = await karbon.listOrganizations(filter);
      if (!res.ok) return { content: [{ type: "text" as const, text: `Error ${res.status}: ${JSON.stringify(res.data)}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(res.data, null, 2) }] };
    },
  );

  server.tool(
    "karbon_get_organization",
    "Get organization details by OrganizationKey",
    { orgKey: z.string().describe("The unique key of the organization") },
    async ({ orgKey }) => {
      const res = await karbon.getOrganization(orgKey);
      if (!res.ok) return { content: [{ type: "text" as const, text: `Error ${res.status}: ${JSON.stringify(res.data)}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(res.data, null, 2) }] };
    },
  );

  // ── Work Items ──────────────────────────────────────────

  server.tool(
    "karbon_list_work_items",
    "List work items (jobs/engagements) in Karbon. Use filters to narrow by client, status, assignee, dates, etc.",
    { filter: z.string().optional().describe("OData $filter expression (e.g. \"ClientKey eq 'abc123'\")") },
    async ({ filter }) => {
      const res = await karbon.listWorkItems(filter);
      if (!res.ok) return { content: [{ type: "text" as const, text: `Error ${res.status}: ${JSON.stringify(res.data)}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(res.data, null, 2) }] };
    },
  );

  server.tool(
    "karbon_get_work_item",
    "Get full details of a specific work item",
    { workItemKey: z.string().describe("The unique key of the work item") },
    async ({ workItemKey }) => {
      const res = await karbon.getWorkItem(workItemKey);
      if (!res.ok) return { content: [{ type: "text" as const, text: `Error ${res.status}: ${JSON.stringify(res.data)}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(res.data, null, 2) }] };
    },
  );

  server.tool(
    "karbon_create_work_item",
    "Create a new work item in Karbon",
    {
      title: z.string().describe("Title for the work item"),
      clientKey: z.string().optional().describe("Client contact key"),
      assigneeKey: z.string().optional().describe("Assignee user key"),
      startDate: z.string().optional().describe("Start date (ISO 8601)"),
      dueDate: z.string().optional().describe("Due date (ISO 8601)"),
      description: z.string().optional().describe("Description of the work"),
      workItemTypeKey: z.string().optional().describe("Work item type key"),
    },
    async (params) => {
      const res = await karbon.createWorkItem({
        Title: params.title,
        ClientKey: params.clientKey,
        AssigneeKey: params.assigneeKey,
        StartDate: params.startDate,
        DueDate: params.dueDate,
        Description: params.description,
        WorkItemTypeKey: params.workItemTypeKey,
      });
      if (!res.ok) return { content: [{ type: "text" as const, text: `Error ${res.status}: ${JSON.stringify(res.data)}` }] };
      return { content: [{ type: "text" as const, text: `Work item created:\n${JSON.stringify(res.data, null, 2)}` }] };
    },
  );

  server.tool(
    "karbon_update_work_item",
    "Update an existing work item (change status, assignee, dates, etc.)",
    {
      workItemKey: z.string().describe("The work item key to update"),
      title: z.string().optional().describe("New title"),
      assigneeKey: z.string().optional().describe("New assignee user key"),
      startDate: z.string().optional().describe("New start date (ISO 8601)"),
      dueDate: z.string().optional().describe("New due date (ISO 8601)"),
      description: z.string().optional().describe("New description"),
      workItemStatusKey: z.string().optional().describe("New status key"),
    },
    async ({ workItemKey, ...updates }) => {
      const data: Partial<karbon.KarbonWorkItem> = {};
      if (updates.title) data.Title = updates.title;
      if (updates.assigneeKey) data.AssigneeKey = updates.assigneeKey;
      if (updates.startDate) data.StartDate = updates.startDate;
      if (updates.dueDate) data.DueDate = updates.dueDate;
      if (updates.description) data.Description = updates.description;
      if (updates.workItemStatusKey) data.WorkItemStatusKey = updates.workItemStatusKey;
      const res = await karbon.updateWorkItem(workItemKey, data);
      if (!res.ok) return { content: [{ type: "text" as const, text: `Error ${res.status}: ${JSON.stringify(res.data)}` }] };
      return { content: [{ type: "text" as const, text: `Work item updated:\n${JSON.stringify(res.data, null, 2)}` }] };
    },
  );

  server.tool(
    "karbon_list_work_item_statuses",
    "List all available work item statuses in Karbon",
    {},
    async () => {
      const res = await karbon.listWorkItemStatuses();
      if (!res.ok) return { content: [{ type: "text" as const, text: `Error ${res.status}: ${JSON.stringify(res.data)}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(res.data, null, 2) }] };
    },
  );

  // ── Tasks ───────────────────────────────────────────────

  server.tool(
    "karbon_list_tasks",
    "List all tasks (to-dos) within a specific work item",
    { workItemKey: z.string().describe("The work item key") },
    async ({ workItemKey }) => {
      const res = await karbon.listTasks(workItemKey);
      if (!res.ok) return { content: [{ type: "text" as const, text: `Error ${res.status}: ${JSON.stringify(res.data)}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(res.data, null, 2) }] };
    },
  );

  server.tool(
    "karbon_create_task",
    "Add a new task to a work item",
    {
      workItemKey: z.string().describe("The work item key"),
      title: z.string().describe("Task title"),
      assigneeKey: z.string().optional().describe("Assignee user key"),
      dueDate: z.string().optional().describe("Due date (ISO 8601)"),
    },
    async ({ workItemKey, title, assigneeKey, dueDate }) => {
      const res = await karbon.createTask(workItemKey, {
        Title: title,
        AssigneeKey: assigneeKey,
        DueDate: dueDate,
      });
      if (!res.ok) return { content: [{ type: "text" as const, text: `Error ${res.status}: ${JSON.stringify(res.data)}` }] };
      return { content: [{ type: "text" as const, text: `Task created:\n${JSON.stringify(res.data, null, 2)}` }] };
    },
  );

  server.tool(
    "karbon_update_task",
    "Update a task within a work item (mark complete, reassign, reschedule)",
    {
      workItemKey: z.string().describe("The work item key"),
      taskKey: z.string().describe("The task key"),
      title: z.string().optional().describe("New title"),
      isCompleted: z.boolean().optional().describe("Mark as completed?"),
      assigneeKey: z.string().optional().describe("New assignee user key"),
      dueDate: z.string().optional().describe("New due date (ISO 8601)"),
    },
    async ({ workItemKey, taskKey, ...updates }) => {
      const data: Partial<karbon.KarbonTask> = {};
      if (updates.title !== undefined) data.Title = updates.title;
      if (updates.isCompleted !== undefined) data.IsCompleted = updates.isCompleted;
      if (updates.assigneeKey) data.AssigneeKey = updates.assigneeKey;
      if (updates.dueDate) data.DueDate = updates.dueDate;
      const res = await karbon.updateTask(workItemKey, taskKey, data);
      if (!res.ok) return { content: [{ type: "text" as const, text: `Error ${res.status}: ${JSON.stringify(res.data)}` }] };
      return { content: [{ type: "text" as const, text: `Task updated:\n${JSON.stringify(res.data, null, 2)}` }] };
    },
  );

  // ── Notes ───────────────────────────────────────────────

  server.tool(
    "karbon_list_notes",
    "List timeline notes for a work item",
    { workItemKey: z.string().describe("The work item key") },
    async ({ workItemKey }) => {
      const res = await karbon.listNotes(workItemKey);
      if (!res.ok) return { content: [{ type: "text" as const, text: `Error ${res.status}: ${JSON.stringify(res.data)}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(res.data, null, 2) }] };
    },
  );

  server.tool(
    "karbon_add_note",
    "Add a note to a work item's timeline",
    {
      workItemKey: z.string().describe("The work item key"),
      body: z.string().describe("Note text content"),
    },
    async ({ workItemKey, body }) => {
      const res = await karbon.addNote(workItemKey, body);
      if (!res.ok) return { content: [{ type: "text" as const, text: `Error ${res.status}: ${JSON.stringify(res.data)}` }] };
      return { content: [{ type: "text" as const, text: `Note added:\n${JSON.stringify(res.data, null, 2)}` }] };
    },
  );

  // ── Time Entries ────────────────────────────────────────

  server.tool(
    "karbon_list_time_entries",
    "List time entries with optional OData filter (by date, user, work item, etc.)",
    { filter: z.string().optional().describe("OData $filter expression") },
    async ({ filter }) => {
      const res = await karbon.listTimeEntries(filter);
      if (!res.ok) return { content: [{ type: "text" as const, text: `Error ${res.status}: ${JSON.stringify(res.data)}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(res.data, null, 2) }] };
    },
  );

  server.tool(
    "karbon_create_time_entry",
    "Log a new time entry in Karbon",
    {
      workItemKey: z.string().optional().describe("Associated work item key"),
      contactKey: z.string().optional().describe("Team member contact key"),
      minutes: z.number().describe("Number of minutes worked"),
      description: z.string().optional().describe("What was done"),
      entryDate: z.string().optional().describe("Date of the entry (ISO 8601)"),
    },
    async (params) => {
      const res = await karbon.createTimeEntry({
        WorkItemKey: params.workItemKey,
        ContactKey: params.contactKey,
        Minutes: params.minutes,
        Description: params.description,
        EntryDate: params.entryDate,
      });
      if (!res.ok) return { content: [{ type: "text" as const, text: `Error ${res.status}: ${JSON.stringify(res.data)}` }] };
      return { content: [{ type: "text" as const, text: `Time entry created:\n${JSON.stringify(res.data, null, 2)}` }] };
    },
  );

  // ── Users ───────────────────────────────────────────────

  server.tool(
    "karbon_list_users",
    "List all team members / users in Karbon",
    {},
    async () => {
      const res = await karbon.listUsers();
      if (!res.ok) return { content: [{ type: "text" as const, text: `Error ${res.status}: ${JSON.stringify(res.data)}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(res.data, null, 2) }] };
    },
  );
}
