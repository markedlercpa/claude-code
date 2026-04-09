/**
 * One-time migration script: Karbon → HubSpot
 * Tags all contacts and companies with lifecycle stage "customer".
 */
import "dotenv/config";
import * as karbon from "./karbon/client.js";
import * as hubspot from "./hubspot/client.js";

function splitName(fullName: string): { firstname: string; lastname: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return { firstname: fullName.trim(), lastname: "" };
  return { firstname: parts[0], lastname: parts.slice(1).join(" ") };
}

function mapDealStage(statusName: string): string {
  const lower = statusName.toLowerCase();
  if (lower.includes("complete") || lower.includes("done") || lower.includes("finished") || lower.includes("closed")) return "closedwon";
  if (lower.includes("progress") || lower.includes("active") || lower.includes("working") || lower.includes("review")) return "contractsent";
  return "appointmentscheduled";
}

async function main() {
  const isDryRun = process.env.DRY_RUN === "true";

  console.log("=== Karbon → HubSpot Migration ===\n");
  if (isDryRun) console.log("*** DRY RUN — no changes will be made to HubSpot ***\n");
  console.log("Lifecycle stage: customer (all records)\n");

  // ── 1. Fetch all Karbon data ──────────────────────────
  console.log("Fetching Karbon data...");

  const [orgsRes, contactsRes, workItemsRes, statusesRes] = await Promise.all([
    karbon.listOrganizations(),
    karbon.listContacts(),
    karbon.listWorkItems(),
    karbon.listWorkItemStatuses(),
  ]);

  if (!orgsRes.ok) { console.error("Failed to fetch organizations:", orgsRes.status, orgsRes.data); process.exit(1); }
  if (!contactsRes.ok) { console.error("Failed to fetch contacts:", contactsRes.status, contactsRes.data); process.exit(1); }
  if (!workItemsRes.ok) { console.error("Failed to fetch work items:", workItemsRes.status, workItemsRes.data); process.exit(1); }
  if (!statusesRes.ok) { console.error("Failed to fetch statuses:", statusesRes.status, statusesRes.data); process.exit(1); }

  const orgs = (Array.isArray(orgsRes.data) ? orgsRes.data : []) as karbon.KarbonOrganization[];
  const contacts = (Array.isArray(contactsRes.data) ? contactsRes.data : []) as karbon.KarbonContact[];
  const workItems = (Array.isArray(workItemsRes.data) ? workItemsRes.data : []) as karbon.KarbonWorkItem[];
  const statuses = (Array.isArray(statusesRes.data) ? statusesRes.data : []) as karbon.KarbonWorkItemStatus[];

  const statusMap = new Map(statuses.map((s) => [s.WorkItemStatusKey, s.StatusName]));

  console.log(`  Organizations: ${orgs.length}`);
  console.log(`  Contacts: ${contacts.length}`);
  console.log(`  Work Items: ${workItems.length}`);
  console.log(`  Statuses: ${statuses.length}\n`);

  const stats = {
    companiesCreated: 0, companiesSkipped: 0,
    contactsCreated: 0, contactsSkipped: 0, contactsNoEmail: 0,
    dealsCreated: 0, dealsSkipped: 0,
    associations: 0, errors: [] as string[],
  };

  // Track HubSpot IDs for associations
  const orgToHubSpotId = new Map<string, string>();
  const contactToHubSpotId = new Map<string, string>();

  // ── 2. Migrate Organizations → Companies ──────────────
  console.log("Migrating organizations → companies...");

  for (const org of orgs) {
    try {
      const existing = await hubspot.searchCompanies(org.OrganizationName);
      if (existing.ok && existing.data.total > 0) {
        orgToHubSpotId.set(org.OrganizationKey, existing.data.results[0].id);
        stats.companiesSkipped++;
        console.log(`  SKIP  ${org.OrganizationName} (already exists)`);
        continue;
      }

      if (isDryRun) {
        stats.companiesCreated++;
        console.log(`  [DRY] Would create company: ${org.OrganizationName} (lifecycle: customer)`);
        continue;
      }

      const res = await hubspot.createCompany({
        name: org.OrganizationName,
        lifecyclestage: "customer",
      });

      if (res.ok) {
        orgToHubSpotId.set(org.OrganizationKey, res.data.id);
        stats.companiesCreated++;
        console.log(`  ✓ Created company: ${org.OrganizationName} → ID ${res.data.id}`);
      } else {
        stats.errors.push(`Company "${org.OrganizationName}": ${res.status}`);
        console.error(`  ✗ Failed: ${org.OrganizationName} (${res.status})`);
      }
    } catch (err) {
      stats.errors.push(`Company "${org.OrganizationName}": ${err}`);
      console.error(`  ✗ Error: ${org.OrganizationName}`);
    }
  }

  console.log(`  → ${stats.companiesCreated} created, ${stats.companiesSkipped} skipped\n`);

  // ── 3. Migrate Contacts ───────────────────────────────
  console.log("Migrating contacts...");

  for (const contact of contacts) {
    try {
      if (!contact.EmailAddress) {
        stats.contactsNoEmail++;
        console.log(`  SKIP  ${contact.FullName} (no email)`);
        continue;
      }

      const existing = await hubspot.searchContacts(contact.EmailAddress);
      if (existing.ok && existing.data.total > 0) {
        contactToHubSpotId.set(contact.ContactKey, existing.data.results[0].id);
        stats.contactsSkipped++;
        console.log(`  SKIP  ${contact.FullName} (already exists)`);
        continue;
      }

      const { firstname, lastname } = splitName(contact.FullName);
      const properties: Record<string, string> = {
        email: contact.EmailAddress,
        firstname,
        lifecyclestage: "customer",
      };
      if (lastname) properties.lastname = lastname;
      if (contact.PhoneNumber) properties.phone = contact.PhoneNumber;

      // Set company name
      if (contact.OrganizationKey) {
        const org = orgs.find((o) => o.OrganizationKey === contact.OrganizationKey);
        if (org) properties.company = org.OrganizationName;
      }

      if (isDryRun) {
        stats.contactsCreated++;
        const orgName = contact.OrganizationKey
          ? orgs.find((o) => o.OrganizationKey === contact.OrganizationKey)?.OrganizationName ?? ""
          : "";
        console.log(`  [DRY] Would create contact: ${contact.FullName} (${contact.EmailAddress})${orgName ? ` @ ${orgName}` : ""} (lifecycle: customer)`);
        continue;
      }

      const res = await hubspot.createContact(properties);

      if (res.ok) {
        contactToHubSpotId.set(contact.ContactKey, res.data.id);
        stats.contactsCreated++;
        console.log(`  ✓ Created contact: ${contact.FullName} (${contact.EmailAddress}) → ID ${res.data.id}`);

        // Associate with company
        if (contact.OrganizationKey) {
          const companyId = orgToHubSpotId.get(contact.OrganizationKey);
          if (companyId) {
            await hubspot.associateContactToCompany(res.data.id, companyId);
            stats.associations++;
          }
        }
      } else {
        stats.errors.push(`Contact "${contact.FullName}": ${res.status}`);
        console.error(`  ✗ Failed: ${contact.FullName} (${res.status})`);
      }
    } catch (err) {
      stats.errors.push(`Contact "${contact.FullName}": ${err}`);
      console.error(`  ✗ Error: ${contact.FullName}`);
    }
  }

  console.log(`  → ${stats.contactsCreated} created, ${stats.contactsSkipped} skipped, ${stats.contactsNoEmail} no email\n`);

  // ── 4. Migrate Work Items → Deals ─────────────────────
  console.log("Migrating work items → deals...");

  for (const wi of workItems) {
    try {
      const existing = await hubspot.searchDeals(wi.Title);
      if (existing.ok && existing.data.total > 0) {
        stats.dealsSkipped++;
        console.log(`  SKIP  ${wi.Title} (already exists)`);
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
        stats.dealsCreated++;
        console.log(`  [DRY] Would create deal: ${wi.Title} [${statusName} → ${dealstage}]`);
        continue;
      }

      const res = await hubspot.createDeal(properties);

      if (res.ok) {
        stats.dealsCreated++;
        console.log(`  ✓ Created deal: ${wi.Title} [${statusName} → ${dealstage}] → ID ${res.data.id}`);

        // Associate deal with contact and company
        if (wi.ClientKey) {
          const contactId = contactToHubSpotId.get(wi.ClientKey);
          if (contactId) {
            await hubspot.associateDealToContact(res.data.id, contactId);
            stats.associations++;
          }

          const companyId = orgToHubSpotId.get(wi.ClientKey);
          if (companyId) {
            await hubspot.associateDealToCompany(res.data.id, companyId);
            stats.associations++;
          }

          // Find org through contact
          const contact = contacts.find((c) => c.ContactKey === wi.ClientKey);
          if (contact?.OrganizationKey) {
            const orgCompanyId = orgToHubSpotId.get(contact.OrganizationKey);
            if (orgCompanyId) {
              await hubspot.associateDealToCompany(res.data.id, orgCompanyId);
              stats.associations++;
            }
          }
        }
      } else {
        stats.errors.push(`Deal "${wi.Title}": ${res.status}`);
        console.error(`  ✗ Failed: ${wi.Title} (${res.status})`);
      }
    } catch (err) {
      stats.errors.push(`Deal "${wi.Title}": ${err}`);
      console.error(`  ✗ Error: ${wi.Title}`);
    }
  }

  console.log(`  → ${stats.dealsCreated} created, ${stats.dealsSkipped} skipped\n`);

  // ── 5. Summary ────────────────────────────────────────
  console.log(`=== Migration ${isDryRun ? "Preview" : "Complete"} ===\n`);
  console.log(`Companies:    ${stats.companiesCreated} ${isDryRun ? "would be created" : "created"}, ${stats.companiesSkipped} skipped`);
  console.log(`Contacts:     ${stats.contactsCreated} ${isDryRun ? "would be created" : "created"}, ${stats.contactsSkipped} skipped, ${stats.contactsNoEmail} no email`);
  console.log(`Deals:        ${stats.dealsCreated} ${isDryRun ? "would be created" : "created"}, ${stats.dealsSkipped} skipped`);
  if (!isDryRun) console.log(`Associations: ${stats.associations}`);

  if (stats.errors.length > 0) {
    console.log(`\nErrors (${stats.errors.length}):`);
    stats.errors.forEach((e) => console.log(`  - ${e}`));
  }

  console.log("\nAll contacts and companies tagged with lifecycle stage: customer");
  if (isDryRun) console.log("\n*** This was a DRY RUN. Run again with DRY_RUN=false to execute. ***");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
