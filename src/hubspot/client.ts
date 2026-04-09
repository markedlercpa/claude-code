import { config } from "../config.js";
import { apiGet, apiPost, apiPatch, apiDelete } from "../http.js";

const headers = () => ({
  Authorization: `Bearer ${config.hubspot.accessToken}`,
  Accept: "application/json",
});

const url = (path: string) => `${config.hubspot.baseUrl}${path}`;

// ── Types ──────────────────────────────────────────────────

export interface HubSpotContact {
  id: string;
  properties: {
    firstname?: string;
    lastname?: string;
    email?: string;
    phone?: string;
    company?: string;
    lifecyclestage?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface HubSpotCompany {
  id: string;
  properties: {
    name?: string;
    domain?: string;
    phone?: string;
    lifecyclestage?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface HubSpotDeal {
  id: string;
  properties: {
    dealname?: string;
    dealstage?: string;
    pipeline?: string;
    closedate?: string;
    amount?: string;
    description?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface HubSpotSearchResponse<T> {
  total: number;
  results: T[];
}

interface HubSpotListResponse<T> {
  results: T[];
  paging?: { next?: { after: string } };
}

// ── Contacts ───────────────────────────────────────────────

export async function searchContacts(email: string) {
  return apiPost<HubSpotSearchResponse<HubSpotContact>>(
    url("/crm/v3/objects/contacts/search"),
    headers(),
    {
      filterGroups: [
        {
          filters: [
            { propertyName: "email", operator: "EQ", value: email },
          ],
        },
      ],
      properties: [
        "firstname",
        "lastname",
        "email",
        "phone",
        "company",
        "lifecyclestage",
      ],
    },
  );
}

export async function createContact(properties: Record<string, string>) {
  return apiPost<HubSpotContact>(
    url("/crm/v3/objects/contacts"),
    headers(),
    { properties },
  );
}

export async function updateContact(
  contactId: string,
  properties: Record<string, string>,
) {
  return apiPatch<HubSpotContact>(
    url(`/crm/v3/objects/contacts/${contactId}`),
    headers(),
    { properties },
  );
}

export async function getContact(contactId: string) {
  return apiGet<HubSpotContact>(
    url(
      `/crm/v3/objects/contacts/${contactId}?properties=firstname,lastname,email,phone,company,lifecyclestage`,
    ),
    headers(),
  );
}

export async function listContacts(after?: string) {
  const query = after ? `?after=${after}&limit=100` : "?limit=100";
  return apiGet<HubSpotListResponse<HubSpotContact>>(
    url(
      `/crm/v3/objects/contacts${query}&properties=firstname,lastname,email,phone,company,lifecyclestage`,
    ),
    headers(),
  );
}

// ── Companies ──────────────────────────────────────────────

export async function searchCompanies(name: string) {
  return apiPost<HubSpotSearchResponse<HubSpotCompany>>(
    url("/crm/v3/objects/companies/search"),
    headers(),
    {
      filterGroups: [
        {
          filters: [
            { propertyName: "name", operator: "EQ", value: name },
          ],
        },
      ],
      properties: ["name", "domain", "phone", "lifecyclestage"],
    },
  );
}

export async function createCompany(properties: Record<string, string>) {
  return apiPost<HubSpotCompany>(
    url("/crm/v3/objects/companies"),
    headers(),
    { properties },
  );
}

export async function updateCompany(
  companyId: string,
  properties: Record<string, string>,
) {
  return apiPatch<HubSpotCompany>(
    url(`/crm/v3/objects/companies/${companyId}`),
    headers(),
    { properties },
  );
}

export async function getCompany(companyId: string) {
  return apiGet<HubSpotCompany>(
    url(
      `/crm/v3/objects/companies/${companyId}?properties=name,domain,phone,lifecyclestage`,
    ),
    headers(),
  );
}

// ── Deals ──────────────────────────────────────────────────

export async function searchDeals(dealname: string) {
  return apiPost<HubSpotSearchResponse<HubSpotDeal>>(
    url("/crm/v3/objects/deals/search"),
    headers(),
    {
      filterGroups: [
        {
          filters: [
            { propertyName: "dealname", operator: "EQ", value: dealname },
          ],
        },
      ],
      properties: [
        "dealname",
        "dealstage",
        "pipeline",
        "closedate",
        "amount",
        "description",
      ],
    },
  );
}

export async function createDeal(properties: Record<string, string>) {
  return apiPost<HubSpotDeal>(
    url("/crm/v3/objects/deals"),
    headers(),
    { properties },
  );
}

export async function updateDeal(
  dealId: string,
  properties: Record<string, string>,
) {
  return apiPatch<HubSpotDeal>(
    url(`/crm/v3/objects/deals/${dealId}`),
    headers(),
    { properties },
  );
}

export async function getDeal(dealId: string) {
  return apiGet<HubSpotDeal>(
    url(
      `/crm/v3/objects/deals/${dealId}?properties=dealname,dealstage,pipeline,closedate,amount,description`,
    ),
    headers(),
  );
}

// ── Associations ───────────────────────────────────────────

export async function associateContactToCompany(
  contactId: string,
  companyId: string,
) {
  return apiPatch<unknown>(
    url(
      `/crm/v3/objects/contacts/${contactId}/associations/companies/${companyId}/contact_to_company`,
    ),
    headers(),
    undefined,
  );
}

export async function associateDealToContact(
  dealId: string,
  contactId: string,
) {
  return apiPatch<unknown>(
    url(
      `/crm/v3/objects/deals/${dealId}/associations/contacts/${contactId}/deal_to_contact`,
    ),
    headers(),
    undefined,
  );
}

export async function associateDealToCompany(
  dealId: string,
  companyId: string,
) {
  return apiPatch<unknown>(
    url(
      `/crm/v3/objects/deals/${dealId}/associations/companies/${companyId}/deal_to_company`,
    ),
    headers(),
    undefined,
  );
}

// ── Batch Create (for migration efficiency) ────────────────

export async function batchCreateContacts(
  inputs: { properties: Record<string, string> }[],
) {
  return apiPost<{ results: HubSpotContact[] }>(
    url("/crm/v3/objects/contacts/batch/create"),
    headers(),
    { inputs },
  );
}

export async function batchCreateCompanies(
  inputs: { properties: Record<string, string> }[],
) {
  return apiPost<{ results: HubSpotCompany[] }>(
    url("/crm/v3/objects/companies/batch/create"),
    headers(),
    { inputs },
  );
}

export async function batchCreateDeals(
  inputs: { properties: Record<string, string> }[],
) {
  return apiPost<{ results: HubSpotDeal[] }>(
    url("/crm/v3/objects/deals/batch/create"),
    headers(),
    { inputs },
  );
}

// ── Delete (for management) ────────────────────────────────

export async function deleteContact(contactId: string) {
  return apiDelete<unknown>(
    url(`/crm/v3/objects/contacts/${contactId}`),
    headers(),
  );
}

export async function deleteCompany(companyId: string) {
  return apiDelete<unknown>(
    url(`/crm/v3/objects/companies/${companyId}`),
    headers(),
  );
}

export async function deleteDeal(dealId: string) {
  return apiDelete<unknown>(
    url(`/crm/v3/objects/deals/${dealId}`),
    headers(),
  );
}
