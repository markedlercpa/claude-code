import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as karbon from "../karbon/client.js";
import * as hubspot from "../hubspot/client.js";

// ── Lifecycle stage logic ──────────────────────────────────
//
// Determines the HubSpot lifecycle stage for a contact or company
// based on the Karbon work items associated with them:
//
//   - Has any active (in-progress) work items  → "customer"
//   - Has only completed work items             → "customer"
//   - Has work items not yet started            → "opportunity"
//   - No work items at all                      → "lead"
//
// Status names are matched heuristically against common Karbon
// status naming conventions.

type LifecycleStage = "lead" | "opportunity" | "customer";

function classifyStatus(statusName: string): "active" | "completed" | "not_started" {
  const lower = statusName.toLowerCase();
  if (
    lower.includes("complete") ||
    lower.includes("done") ||
    lower.includes("finished") ||
    lower.includes("closed") ||
    lower.includes("final")
  ) {
    return "completed";
  }
  if (
    lower.includes("progress") ||
    lower.includes("active") ||
    lower.includes("working") ||
    lower.includes("review") ||
    lower.includes("started")
  ) {
    return "active";
  }
  // "Not Started", "New", "Pending", "Draft", etc.
  return "not_started";
}

function determineLifecycle(
  statusNames: string[],
): LifecycleStage {
  if (statusNames.length === 0) return "lead";

  const classes = statusNames.map(classifyStatus);

  if (classes.includes("active")) return "customer";
  if (classes.includes("completed")) return "customer";
  // Only not-started work items
  return "opportunity";
}

// ── Deal stage mapping ─────────────────────────────────────
//
// Maps a Karbon work item status name to a HubSpot default pipeline deal stage.

function mapDealStage(statusName: string): string {
  const cls = classifyStatus(statusName);
  switch (cls) {
    case "completed":
      return "closedwon";
    case "active":
      return "contractsent"; // mid-pipeline stage for active work
    case "not_started":
      return "appointmentscheduled"; // early pipeline stage
  }
}

// ── Helpers ────────────────────────────────────────────────

function splitName(fullName: string): { firstname: string; lastname: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return { firstname: fullName.trim(), lastname: "" };
  const firstname = parts[0];
  const lastname = parts.slice(1).join(" ");
  return { firstname, lastname };
}

interface MigrationResult {
  companiesCreated: number;
  companiesSkipped: number;
  contactsCreated: number;
  contactsSkipped: number;
  dealsCreated: number;
  dealsSkipped: number;
  associationsMade: number;
  errors: string[];
}

// ── Tool registration ──────────────────────────────────────

export function registerMigrationTools(server: McpServer) {
  server.tool(
    "migrate_karbon_to_hubspot",
    "Migrate all Karbon contacts, organizations, and work items to HubSpot with automatic lifecycle stage tagging. " +
      "Organizations become Companies, Contacts become Contacts, Work Items become Deals. " +
      "Lifecycle stages are assigned based on work item status: active/completed work → customer, pending work → opportunity, no work → lead.",
    {
      dryRun: z
        .boolean()
        .optional()
        .describe(
          "If true, preview what would be migrated without creating anything in HubSpot (default: false)",
        ),
    },
    async ({ dryRun }) => {
      const isDryRun = dryRun ?? false;
      const result: MigrationResult = {
        companiesCreated: 0,
        companiesSkipped: 0,
        contactsCreated: 0,
        contactsSkipped: 0,
        dealsCreated: 0,
        dealsSkipped: 0,
        associationsMade: 0,
        errors: [],
      };

      // 1. Fetch all Karbon data in parallel
      const [orgsRes, contactsRes, workItemsRes, statusesRes] =
        await Promise.allSettled([
          karbon.listOrganizations(),
          karbon.listContacts(),
          karbon.listWorkItems(),
          karbon.listWorkItemStatuses(),
        ]);

      if (orgsRes.status !== "fulfilled" || !orgsRes.value.ok) {
        return {
          content: [{ type: "text" as const, text: "Error: Could not fetch Karbon organizations." }],
        };
      }
      if (contactsRes.status !== "fulfilled" || !contactsRes.value.ok) {
        return {
          content: [{ type: "text" as const, text: "Error: Could not fetch Karbon contacts." }],
        };
      }
      if (workItemsRes.status !== "fulfilled" || !workItemsRes.value.ok) {
        return {
          content: [{ type: "text" as const, text: "Error: Could not fetch Karbon work items." }],
        };
      }
      if (statusesRes.status !== "fulfilled" || !statusesRes.value.ok) {
        return {
          content: [{ type: "text" as const, text: "Error: Could not fetch Karbon work item statuses." }],
        };
      }

      const orgs = (Array.isArray(orgsRes.value.data) ? orgsRes.value.data : []) as karbon.KarbonOrganization[];
      const contacts = (Array.isArray(contactsRes.value.data) ? contactsRes.value.data : []) as karbon.KarbonContact[];
      const workItems = (Array.isArray(workItemsRes.value.data) ? workItemsRes.value.data : []) as karbon.KarbonWorkItem[];
      const statuses = (Array.isArray(statusesRes.value.data) ? statusesRes.value.data : []) as karbon.KarbonWorkItemStatus[];

      const statusMap = new Map(statuses.map((s) => [s.WorkItemStatusKey, s.StatusName]));

      // 2. Build maps: ClientKey → list of status names
      const clientWorkStatuses = new Map<string, string[]>();
      for (const wi of workItems) {
        if (wi.ClientKey) {
          const statusName = statusMap.get(wi.WorkItemStatusKey ?? "") ?? "Unknown";
          const existing = clientWorkStatuses.get(wi.ClientKey) ?? [];
          existing.push(statusName);
          clientWorkStatuses.set(wi.ClientKey, existing);
        }
      }

      // Also build OrgKey → list of status names (via contacts in that org)
      const orgWorkStatuses = new Map<string, string[]>();
      for (const contact of contacts) {
        if (contact.OrganizationKey && clientWorkStatuses.has(contact.ContactKey)) {
          const existing = orgWorkStatuses.get(contact.OrganizationKey) ?? [];
          existing.push(...(clientWorkStatuses.get(contact.ContactKey) ?? []));
          orgWorkStatuses.set(contact.OrganizationKey, existing);
        }
      }
      // Also check work items keyed directly by org
      for (const wi of workItems) {
        if (wi.ClientKey) {
          // Check if ClientKey matches any org key directly
          const org = orgs.find((o) => o.OrganizationKey === wi.ClientKey);
          if (org) {
            const statusName = statusMap.get(wi.WorkItemStatusKey ?? "") ?? "Unknown";
            const existing = orgWorkStatuses.get(org.OrganizationKey) ?? [];
            existing.push(statusName);
            orgWorkStatuses.set(org.OrganizationKey, existing);
          }
        }
      }

      // Track HubSpot IDs for associations
      const orgToHubSpotId = new Map<string, string>();
      const contactToHubSpotId = new Map<string, string>();

      // ── 3. Migrate Organizations → Companies ──────────

      for (const org of orgs) {
        try {
          // Check if company already exists
          const existing = await hubspot.searchCompanies(org.OrganizationName);
          if (existing.ok && existing.data.total > 0) {
            orgToHubSpotId.set(org.OrganizationKey, existing.data.results[0].id);
            result.companiesSkipped++;
            continue;
          }

          const lifecycle = determineLifecycle(
            orgWorkStatuses.get(org.OrganizationKey) ?? [],
          );

          if (isDryRun) {
            result.companiesCreated++;
            continue;
          }

          const res = await hubspot.createCompany({
            name: org.OrganizationName,
            lifecyclestage: lifecycle,
          });
          if (res.ok) {
            orgToHubSpotId.set(org.OrganizationKey, res.data.id);
            result.companiesCreated++;
          } else {
            result.errors.push(
              `Company "${org.OrganizationName}": ${res.status} ${JSON.stringify(res.data)}`,
            );
          }
        } catch (err) {
          result.errors.push(
            `Company "${org.OrganizationName}": ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      // ── 4. Migrate Contacts ───────────────────────────

      for (const contact of contacts) {
        try {
          if (!contact.EmailAddress) {
            result.contactsSkipped++;
            continue;
          }

          // Check if contact already exists
          const existing = await hubspot.searchContacts(contact.EmailAddress);
          if (existing.ok && existing.data.total > 0) {
            contactToHubSpotId.set(contact.ContactKey, existing.data.results[0].id);
            result.contactsSkipped++;
            continue;
          }

          const lifecycle = determineLifecycle(
            clientWorkStatuses.get(contact.ContactKey) ?? [],
          );
          const { firstname, lastname } = splitName(contact.FullName);

          const properties: Record<string, string> = {
            email: contact.EmailAddress,
            firstname,
            lifecyclestage: lifecycle,
          };
          if (lastname) properties.lastname = lastname;
          if (contact.PhoneNumber) properties.phone = contact.PhoneNumber;

          // Set company name if org exists
          if (contact.OrganizationKey) {
            const org = orgs.find((o) => o.OrganizationKey === contact.OrganizationKey);
            if (org) properties.company = org.OrganizationName;
          }

          if (isDryRun) {
            result.contactsCreated++;
            continue;
          }

          const res = await hubspot.createContact(properties);
          if (res.ok) {
            contactToHubSpotId.set(contact.ContactKey, res.data.id);
            result.contactsCreated++;

            // Associate with company if org was migrated
            if (contact.OrganizationKey) {
              const companyId = orgToHubSpotId.get(contact.OrganizationKey);
              if (companyId) {
                await hubspot.associateContactToCompany(res.data.id, companyId);
                result.associationsMade++;
              }
            }
          } else {
            result.errors.push(
              `Contact "${contact.FullName}": ${res.status} ${JSON.stringify(res.data)}`,
            );
          }
        } catch (err) {
          result.errors.push(
            `Contact "${contact.FullName}": ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      // ── 5. Migrate Work Items → Deals ─────────────────

      for (const wi of workItems) {
        try {
          // Check if deal already exists
          const existing = await hubspot.searchDeals(wi.Title);
          if (existing.ok && existing.data.total > 0) {
            result.dealsSkipped++;
            continue;
          }

          const statusName = statusMap.get(wi.WorkItemStatusKey ?? "") ?? "Unknown";
          const dealstage = mapDealStage(statusName);

          const properties: Record<string, string> = {
            dealname: wi.Title,
            dealstage,
            pipeline: "default",
          };
          if (wi.DueDate) properties.closedate = wi.DueDate;
          if (wi.Description) properties.description = wi.Description;

          if (isDryRun) {
            result.dealsCreated++;
            continue;
          }

          const res = await hubspot.createDeal(properties);
          if (res.ok) {
            // Associate deal with contact and company
            if (wi.ClientKey) {
              const contactId = contactToHubSpotId.get(wi.ClientKey);
              if (contactId) {
                await hubspot.associateDealToContact(res.data.id, contactId);
                result.associationsMade++;
              }
              // Check if client is an org directly
              const companyId = orgToHubSpotId.get(wi.ClientKey);
              if (companyId) {
                await hubspot.associateDealToCompany(res.data.id, companyId);
                result.associationsMade++;
              }
              // Or find org through contact
              const contact = contacts.find((c) => c.ContactKey === wi.ClientKey);
              if (contact?.OrganizationKey) {
                const orgCompanyId = orgToHubSpotId.get(contact.OrganizationKey);
                if (orgCompanyId) {
                  await hubspot.associateDealToCompany(res.data.id, orgCompanyId);
                  result.associationsMade++;
                }
              }
            }
            result.dealsCreated++;
          } else {
            result.errors.push(
              `Deal "${wi.Title}": ${res.status} ${JSON.stringify(res.data)}`,
            );
          }
        } catch (err) {
          result.errors.push(
            `Deal "${wi.Title}": ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      // ── 6. Format report ──────────────────────────────

      const sections: string[] = [
        `# Karbon → HubSpot Migration ${isDryRun ? "(DRY RUN)" : "Report"}\n`,
        `## Summary`,
        `| Entity | Created | Skipped (already exists) |`,
        `|--------|---------|-------------------------|`,
        `| Companies | ${result.companiesCreated} | ${result.companiesSkipped} |`,
        `| Contacts | ${result.contactsCreated} | ${result.contactsSkipped} |`,
        `| Deals | ${result.dealsCreated} | ${result.dealsSkipped} |`,
        ``,
        `**Associations created:** ${result.associationsMade}`,
        ``,
        `## Lifecycle Stage Tagging`,
        `Contacts and companies were tagged based on their Karbon work item status:`,
        `- **customer** — has active or completed work items`,
        `- **opportunity** — has work items not yet started`,
        `- **lead** — no associated work items`,
        ``,
        `## Deal Stage Mapping`,
        `Work items were mapped to HubSpot deal stages:`,
        `- Active/In Progress → \`contractsent\``,
        `- Not Started/Pending → \`appointmentscheduled\``,
        `- Completed/Done → \`closedwon\``,
      ];

      if (result.errors.length > 0) {
        sections.push(
          ``,
          `## Errors (${result.errors.length})`,
          ...result.errors.map((e) => `- ${e}`),
        );
      }

      if (isDryRun) {
        sections.push(
          ``,
          `_This was a dry run. No data was created in HubSpot. Run again with dryRun=false to execute._`,
        );
      }

      return {
        content: [{ type: "text" as const, text: sections.join("\n") }],
      };
    },
  );

  // ── Preview lifecycle tags ──────────────────────────────

  server.tool(
    "preview_lifecycle_tags",
    "Preview what lifecycle stage each Karbon contact and organization would receive in HubSpot, without migrating anything",
    {},
    async () => {
      const [orgsRes, contactsRes, workItemsRes, statusesRes] =
        await Promise.allSettled([
          karbon.listOrganizations(),
          karbon.listContacts(),
          karbon.listWorkItems(),
          karbon.listWorkItemStatuses(),
        ]);

      if (
        orgsRes.status !== "fulfilled" || !orgsRes.value.ok ||
        contactsRes.status !== "fulfilled" || !contactsRes.value.ok ||
        workItemsRes.status !== "fulfilled" || !workItemsRes.value.ok ||
        statusesRes.status !== "fulfilled" || !statusesRes.value.ok
      ) {
        return {
          content: [{ type: "text" as const, text: "Error: Could not fetch data from Karbon." }],
        };
      }

      const orgs = (Array.isArray(orgsRes.value.data) ? orgsRes.value.data : []) as karbon.KarbonOrganization[];
      const contacts = (Array.isArray(contactsRes.value.data) ? contactsRes.value.data : []) as karbon.KarbonContact[];
      const workItems = (Array.isArray(workItemsRes.value.data) ? workItemsRes.value.data : []) as karbon.KarbonWorkItem[];
      const statuses = (Array.isArray(statusesRes.value.data) ? statusesRes.value.data : []) as karbon.KarbonWorkItemStatus[];

      const statusMap = new Map(statuses.map((s) => [s.WorkItemStatusKey, s.StatusName]));

      // Build maps
      const clientWorkStatuses = new Map<string, string[]>();
      for (const wi of workItems) {
        if (wi.ClientKey) {
          const statusName = statusMap.get(wi.WorkItemStatusKey ?? "") ?? "Unknown";
          const existing = clientWorkStatuses.get(wi.ClientKey) ?? [];
          existing.push(statusName);
          clientWorkStatuses.set(wi.ClientKey, existing);
        }
      }

      const orgWorkStatuses = new Map<string, string[]>();
      for (const contact of contacts) {
        if (contact.OrganizationKey && clientWorkStatuses.has(contact.ContactKey)) {
          const existing = orgWorkStatuses.get(contact.OrganizationKey) ?? [];
          existing.push(...(clientWorkStatuses.get(contact.ContactKey) ?? []));
          orgWorkStatuses.set(contact.OrganizationKey, existing);
        }
      }
      for (const wi of workItems) {
        if (wi.ClientKey) {
          const org = orgs.find((o) => o.OrganizationKey === wi.ClientKey);
          if (org) {
            const statusName = statusMap.get(wi.WorkItemStatusKey ?? "") ?? "Unknown";
            const existing = orgWorkStatuses.get(org.OrganizationKey) ?? [];
            existing.push(statusName);
            orgWorkStatuses.set(org.OrganizationKey, existing);
          }
        }
      }

      const sections: string[] = ["# Lifecycle Stage Preview\n"];

      // Organizations
      const orgsByStage: Record<string, string[]> = {};
      for (const org of orgs) {
        const stage = determineLifecycle(orgWorkStatuses.get(org.OrganizationKey) ?? []);
        (orgsByStage[stage] ??= []).push(org.OrganizationName);
      }

      sections.push("## Organizations");
      for (const [stage, names] of Object.entries(orgsByStage)) {
        sections.push(`### ${stage} (${names.length})`);
        names.forEach((n) => sections.push(`- ${n}`));
        sections.push("");
      }

      // Contacts
      const contactsByStage: Record<string, string[]> = {};
      for (const contact of contacts) {
        const stage = determineLifecycle(clientWorkStatuses.get(contact.ContactKey) ?? []);
        (contactsByStage[stage] ??= []).push(
          `${contact.FullName} (${contact.EmailAddress || "no email"})`,
        );
      }

      sections.push("## Contacts");
      for (const [stage, names] of Object.entries(contactsByStage)) {
        sections.push(`### ${stage} (${names.length})`);
        names.slice(0, 25).forEach((n) => sections.push(`- ${n}`));
        if (names.length > 25) {
          sections.push(`- _...and ${names.length - 25} more_`);
        }
        sections.push("");
      }

      // Summary counts
      sections.push("## Summary");
      sections.push(`| Lifecycle Stage | Organizations | Contacts |`);
      sections.push(`|-----------------|---------------|----------|`);
      for (const stage of ["customer", "opportunity", "lead"] as const) {
        sections.push(
          `| ${stage} | ${(orgsByStage[stage] ?? []).length} | ${(contactsByStage[stage] ?? []).length} |`,
        );
      }

      return {
        content: [{ type: "text" as const, text: sections.join("\n") }],
      };
    },
  );

  // ── Migrate single contact ────────────────────────────

  server.tool(
    "migrate_karbon_contact_to_hubspot",
    "Migrate a single Karbon contact to HubSpot with lifecycle tagging. Looks up associated work items to determine lifecycle stage.",
    {
      contactKey: z.string().describe("Karbon ContactKey to migrate"),
    },
    async ({ contactKey }) => {
      // Fetch contact
      const contactRes = await karbon.getContact(contactKey);
      if (!contactRes.ok) {
        return {
          content: [{ type: "text" as const, text: `Error fetching contact: ${contactRes.status}` }],
        };
      }
      const contact = contactRes.data;

      if (!contact.EmailAddress) {
        return {
          content: [{ type: "text" as const, text: `Contact "${contact.FullName}" has no email address — cannot create in HubSpot.` }],
        };
      }

      // Check if already exists
      const existing = await hubspot.searchContacts(contact.EmailAddress);
      if (existing.ok && existing.data.total > 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Contact "${contact.FullName}" already exists in HubSpot (ID: ${existing.data.results[0].id}, lifecycle: ${existing.data.results[0].properties.lifecyclestage ?? "unknown"}).`,
            },
          ],
        };
      }

      // Fetch work items and statuses for lifecycle determination
      const [workItemsRes, statusesRes] = await Promise.allSettled([
        karbon.listWorkItems(`ClientKey eq '${contactKey}'`),
        karbon.listWorkItemStatuses(),
      ]);

      const workItems =
        workItemsRes.status === "fulfilled" && workItemsRes.value.ok && Array.isArray(workItemsRes.value.data)
          ? (workItemsRes.value.data as karbon.KarbonWorkItem[])
          : [];
      const statuses =
        statusesRes.status === "fulfilled" && statusesRes.value.ok && Array.isArray(statusesRes.value.data)
          ? (statusesRes.value.data as karbon.KarbonWorkItemStatus[])
          : [];

      const statusMap = new Map(statuses.map((s) => [s.WorkItemStatusKey, s.StatusName]));
      const statusNames = workItems.map(
        (wi) => statusMap.get(wi.WorkItemStatusKey ?? "") ?? "Unknown",
      );
      const lifecycle = determineLifecycle(statusNames);
      const { firstname, lastname } = splitName(contact.FullName);

      const properties: Record<string, string> = {
        email: contact.EmailAddress,
        firstname,
        lifecyclestage: lifecycle,
      };
      if (lastname) properties.lastname = lastname;
      if (contact.PhoneNumber) properties.phone = contact.PhoneNumber;

      const res = await hubspot.createContact(properties);
      if (!res.ok) {
        return {
          content: [{ type: "text" as const, text: `Error creating contact: ${res.status} ${JSON.stringify(res.data)}` }],
        };
      }

      const sections = [
        `Contact migrated to HubSpot:`,
        `- **Name:** ${contact.FullName}`,
        `- **Email:** ${contact.EmailAddress}`,
        `- **HubSpot ID:** ${res.data.id}`,
        `- **Lifecycle Stage:** ${lifecycle}`,
        `- **Work Items Found:** ${workItems.length}`,
        workItems.length > 0
          ? `- **Work Item Statuses:** ${statusNames.join(", ")}`
          : "",
      ];

      return {
        content: [{ type: "text" as const, text: sections.filter(Boolean).join("\n") }],
      };
    },
  );
}
