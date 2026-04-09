import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as hubspot from "./client.js";

export function registerHubSpotTools(server: McpServer) {
  // ── Contacts ────────────────────────────────────────────

  server.tool(
    "hubspot_search_contacts",
    "Search for a contact in HubSpot by email address",
    { email: z.string().describe("Email address to search for") },
    async ({ email }) => {
      const res = await hubspot.searchContacts(email);
      if (!res.ok) return { content: [{ type: "text" as const, text: `Error ${res.status}: ${JSON.stringify(res.data)}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(res.data, null, 2) }] };
    },
  );

  server.tool(
    "hubspot_get_contact",
    "Get a HubSpot contact by ID",
    { contactId: z.string().describe("HubSpot contact ID") },
    async ({ contactId }) => {
      const res = await hubspot.getContact(contactId);
      if (!res.ok) return { content: [{ type: "text" as const, text: `Error ${res.status}: ${JSON.stringify(res.data)}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(res.data, null, 2) }] };
    },
  );

  server.tool(
    "hubspot_create_contact",
    "Create a new contact in HubSpot",
    {
      email: z.string().describe("Email address"),
      firstname: z.string().optional().describe("First name"),
      lastname: z.string().optional().describe("Last name"),
      phone: z.string().optional().describe("Phone number"),
      company: z.string().optional().describe("Company name"),
      lifecyclestage: z
        .enum([
          "subscriber",
          "lead",
          "marketingqualifiedlead",
          "salesqualifiedlead",
          "opportunity",
          "customer",
          "evangelist",
          "other",
        ])
        .optional()
        .describe("HubSpot lifecycle stage"),
    },
    async (params) => {
      const properties: Record<string, string> = { email: params.email };
      if (params.firstname) properties.firstname = params.firstname;
      if (params.lastname) properties.lastname = params.lastname;
      if (params.phone) properties.phone = params.phone;
      if (params.company) properties.company = params.company;
      if (params.lifecyclestage) properties.lifecyclestage = params.lifecyclestage;
      const res = await hubspot.createContact(properties);
      if (!res.ok) return { content: [{ type: "text" as const, text: `Error ${res.status}: ${JSON.stringify(res.data)}` }] };
      return { content: [{ type: "text" as const, text: `Contact created:\n${JSON.stringify(res.data, null, 2)}` }] };
    },
  );

  server.tool(
    "hubspot_update_contact",
    "Update an existing HubSpot contact",
    {
      contactId: z.string().describe("HubSpot contact ID"),
      email: z.string().optional().describe("Email address"),
      firstname: z.string().optional().describe("First name"),
      lastname: z.string().optional().describe("Last name"),
      phone: z.string().optional().describe("Phone number"),
      company: z.string().optional().describe("Company name"),
      lifecyclestage: z
        .enum([
          "subscriber",
          "lead",
          "marketingqualifiedlead",
          "salesqualifiedlead",
          "opportunity",
          "customer",
          "evangelist",
          "other",
        ])
        .optional()
        .describe("HubSpot lifecycle stage"),
    },
    async ({ contactId, ...updates }) => {
      const properties: Record<string, string> = {};
      if (updates.email) properties.email = updates.email;
      if (updates.firstname) properties.firstname = updates.firstname;
      if (updates.lastname) properties.lastname = updates.lastname;
      if (updates.phone) properties.phone = updates.phone;
      if (updates.company) properties.company = updates.company;
      if (updates.lifecyclestage) properties.lifecyclestage = updates.lifecyclestage;
      const res = await hubspot.updateContact(contactId, properties);
      if (!res.ok) return { content: [{ type: "text" as const, text: `Error ${res.status}: ${JSON.stringify(res.data)}` }] };
      return { content: [{ type: "text" as const, text: `Contact updated:\n${JSON.stringify(res.data, null, 2)}` }] };
    },
  );

  server.tool(
    "hubspot_list_contacts",
    "List contacts in HubSpot (paginated, 100 per page)",
    { after: z.string().optional().describe("Pagination cursor from previous response") },
    async ({ after }) => {
      const res = await hubspot.listContacts(after);
      if (!res.ok) return { content: [{ type: "text" as const, text: `Error ${res.status}: ${JSON.stringify(res.data)}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(res.data, null, 2) }] };
    },
  );

  server.tool(
    "hubspot_delete_contact",
    "Delete a contact from HubSpot",
    { contactId: z.string().describe("HubSpot contact ID") },
    async ({ contactId }) => {
      const res = await hubspot.deleteContact(contactId);
      if (!res.ok) return { content: [{ type: "text" as const, text: `Error ${res.status}: ${JSON.stringify(res.data)}` }] };
      return { content: [{ type: "text" as const, text: `Contact ${contactId} deleted.` }] };
    },
  );

  // ── Companies ───────────────────────────────────────────

  server.tool(
    "hubspot_search_companies",
    "Search for a company in HubSpot by name",
    { name: z.string().describe("Company name to search for") },
    async ({ name }) => {
      const res = await hubspot.searchCompanies(name);
      if (!res.ok) return { content: [{ type: "text" as const, text: `Error ${res.status}: ${JSON.stringify(res.data)}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(res.data, null, 2) }] };
    },
  );

  server.tool(
    "hubspot_create_company",
    "Create a new company in HubSpot",
    {
      name: z.string().describe("Company name"),
      domain: z.string().optional().describe("Company website domain"),
      phone: z.string().optional().describe("Company phone number"),
      lifecyclestage: z
        .enum([
          "subscriber",
          "lead",
          "marketingqualifiedlead",
          "salesqualifiedlead",
          "opportunity",
          "customer",
          "evangelist",
          "other",
        ])
        .optional()
        .describe("HubSpot lifecycle stage"),
    },
    async (params) => {
      const properties: Record<string, string> = { name: params.name };
      if (params.domain) properties.domain = params.domain;
      if (params.phone) properties.phone = params.phone;
      if (params.lifecyclestage) properties.lifecyclestage = params.lifecyclestage;
      const res = await hubspot.createCompany(properties);
      if (!res.ok) return { content: [{ type: "text" as const, text: `Error ${res.status}: ${JSON.stringify(res.data)}` }] };
      return { content: [{ type: "text" as const, text: `Company created:\n${JSON.stringify(res.data, null, 2)}` }] };
    },
  );

  server.tool(
    "hubspot_update_company",
    "Update an existing HubSpot company",
    {
      companyId: z.string().describe("HubSpot company ID"),
      name: z.string().optional().describe("Company name"),
      domain: z.string().optional().describe("Company website domain"),
      phone: z.string().optional().describe("Phone number"),
      lifecyclestage: z
        .enum([
          "subscriber",
          "lead",
          "marketingqualifiedlead",
          "salesqualifiedlead",
          "opportunity",
          "customer",
          "evangelist",
          "other",
        ])
        .optional()
        .describe("HubSpot lifecycle stage"),
    },
    async ({ companyId, ...updates }) => {
      const properties: Record<string, string> = {};
      if (updates.name) properties.name = updates.name;
      if (updates.domain) properties.domain = updates.domain;
      if (updates.phone) properties.phone = updates.phone;
      if (updates.lifecyclestage) properties.lifecyclestage = updates.lifecyclestage;
      const res = await hubspot.updateCompany(companyId, properties);
      if (!res.ok) return { content: [{ type: "text" as const, text: `Error ${res.status}: ${JSON.stringify(res.data)}` }] };
      return { content: [{ type: "text" as const, text: `Company updated:\n${JSON.stringify(res.data, null, 2)}` }] };
    },
  );

  // ── Deals ──────────────────────────────────────────────

  server.tool(
    "hubspot_search_deals",
    "Search for a deal in HubSpot by name",
    { dealname: z.string().describe("Deal name to search for") },
    async ({ dealname }) => {
      const res = await hubspot.searchDeals(dealname);
      if (!res.ok) return { content: [{ type: "text" as const, text: `Error ${res.status}: ${JSON.stringify(res.data)}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(res.data, null, 2) }] };
    },
  );

  server.tool(
    "hubspot_create_deal",
    "Create a new deal in HubSpot",
    {
      dealname: z.string().describe("Deal name"),
      dealstage: z.string().optional().describe("Deal stage ID (e.g. 'appointmentscheduled', 'closedwon')"),
      pipeline: z.string().optional().describe("Pipeline ID (defaults to 'default')"),
      closedate: z.string().optional().describe("Expected close date (ISO 8601)"),
      amount: z.string().optional().describe("Deal amount"),
      description: z.string().optional().describe("Deal description"),
    },
    async (params) => {
      const properties: Record<string, string> = {
        dealname: params.dealname,
      };
      if (params.dealstage) properties.dealstage = params.dealstage;
      if (params.pipeline) properties.pipeline = params.pipeline;
      if (params.closedate) properties.closedate = params.closedate;
      if (params.amount) properties.amount = params.amount;
      if (params.description) properties.description = params.description;
      const res = await hubspot.createDeal(properties);
      if (!res.ok) return { content: [{ type: "text" as const, text: `Error ${res.status}: ${JSON.stringify(res.data)}` }] };
      return { content: [{ type: "text" as const, text: `Deal created:\n${JSON.stringify(res.data, null, 2)}` }] };
    },
  );

  server.tool(
    "hubspot_update_deal",
    "Update an existing HubSpot deal",
    {
      dealId: z.string().describe("HubSpot deal ID"),
      dealname: z.string().optional().describe("Deal name"),
      dealstage: z.string().optional().describe("Deal stage ID"),
      closedate: z.string().optional().describe("Close date (ISO 8601)"),
      amount: z.string().optional().describe("Deal amount"),
      description: z.string().optional().describe("Deal description"),
    },
    async ({ dealId, ...updates }) => {
      const properties: Record<string, string> = {};
      if (updates.dealname) properties.dealname = updates.dealname;
      if (updates.dealstage) properties.dealstage = updates.dealstage;
      if (updates.closedate) properties.closedate = updates.closedate;
      if (updates.amount) properties.amount = updates.amount;
      if (updates.description) properties.description = updates.description;
      const res = await hubspot.updateDeal(dealId, properties);
      if (!res.ok) return { content: [{ type: "text" as const, text: `Error ${res.status}: ${JSON.stringify(res.data)}` }] };
      return { content: [{ type: "text" as const, text: `Deal updated:\n${JSON.stringify(res.data, null, 2)}` }] };
    },
  );

  // ── Associations ───────────────────────────────────────

  server.tool(
    "hubspot_associate_contact_company",
    "Associate a HubSpot contact with a company",
    {
      contactId: z.string().describe("HubSpot contact ID"),
      companyId: z.string().describe("HubSpot company ID"),
    },
    async ({ contactId, companyId }) => {
      const res = await hubspot.associateContactToCompany(contactId, companyId);
      if (!res.ok) return { content: [{ type: "text" as const, text: `Error ${res.status}: ${JSON.stringify(res.data)}` }] };
      return { content: [{ type: "text" as const, text: `Contact ${contactId} associated with company ${companyId}.` }] };
    },
  );

  server.tool(
    "hubspot_associate_deal_contact",
    "Associate a HubSpot deal with a contact",
    {
      dealId: z.string().describe("HubSpot deal ID"),
      contactId: z.string().describe("HubSpot contact ID"),
    },
    async ({ dealId, contactId }) => {
      const res = await hubspot.associateDealToContact(dealId, contactId);
      if (!res.ok) return { content: [{ type: "text" as const, text: `Error ${res.status}: ${JSON.stringify(res.data)}` }] };
      return { content: [{ type: "text" as const, text: `Deal ${dealId} associated with contact ${contactId}.` }] };
    },
  );

  server.tool(
    "hubspot_associate_deal_company",
    "Associate a HubSpot deal with a company",
    {
      dealId: z.string().describe("HubSpot deal ID"),
      companyId: z.string().describe("HubSpot company ID"),
    },
    async ({ dealId, companyId }) => {
      const res = await hubspot.associateDealToCompany(dealId, companyId);
      if (!res.ok) return { content: [{ type: "text" as const, text: `Error ${res.status}: ${JSON.stringify(res.data)}` }] };
      return { content: [{ type: "text" as const, text: `Deal ${dealId} associated with company ${companyId}.` }] };
    },
  );
}
