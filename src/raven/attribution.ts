/**
 * Owner attribution (§6).
 *
 * Every outbound email resolves to a specific human "on behalf of" owner:
 *   1. Look up the HubSpot deal associated with the prospect/thread.
 *   2. Use the deal's owner as the attributed human.
 *   3. Fallback (OPEN DECISION — confirm with Mark before finalizing, §6/§10):
 *      configurable via DEFAULT_OWNER_ON_UNASSIGNED. When no default is set,
 *      hold the email as an unsigned draft rather than guessing an owner.
 *
 * The HubSpot lookup uses HUBSPOT_ACCESS_TOKEN (same convention as the
 * karbon→hubspot migration workflow). If the token is absent, the lookup is
 * skipped and attribution goes straight to the fallback path — so this stays
 * functional in environments where HubSpot isn't wired yet.
 */
import { config } from "../config.js";
import { apiGet, apiPost } from "../http.js";

export type OwnerSource = "hubspot" | "default" | "unassigned";

export interface OwnerAttribution {
  /** Display name used in the sign-off, or null when unassigned + held. */
  ownerName: string | null;
  ownerEmail: string | null;
  dealId: string | null;
  source: OwnerSource;
  /** When true, the message must be held as a draft, not sent (§6). */
  holdAsDraft: boolean;
  rationale: string;
}

function hubspotHeaders() {
  return {
    Authorization: `Bearer ${config.hubspot.accessToken}`,
    Accept: "application/json",
  };
}

const hs = (path: string) => `${config.hubspot.baseUrl}${path}`;

interface HubSpotOwner {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

/** Resolve a HubSpot owner id to a name/email. */
async function getOwner(ownerId: string): Promise<HubSpotOwner | null> {
  const res = await apiGet<HubSpotOwner>(hs(`/crm/v3/owners/${ownerId}`), hubspotHeaders());
  return res.ok ? res.data : null;
}

/** Find the deal owner id for a given deal. */
async function getDealOwner(
  dealId: string,
): Promise<{ ownerId: string | null }> {
  const res = await apiGet<{ properties?: { hubspot_owner_id?: string } }>(
    hs(`/crm/v3/objects/deals/${dealId}?properties=hubspot_owner_id`),
    hubspotHeaders(),
  );
  return { ownerId: res.ok ? res.data.properties?.hubspot_owner_id ?? null : null };
}

/** Find the most recent deal associated with a contact email. */
async function findDealIdByEmail(email: string): Promise<string | null> {
  // Search the contact by email, then read its associated deals.
  const search = await apiPost<{ results?: { id: string }[] }>(
    hs("/crm/v3/objects/contacts/search"),
    hubspotHeaders(),
    {
      filterGroups: [
        { filters: [{ propertyName: "email", operator: "EQ", value: email }] },
      ],
      properties: ["email"],
      limit: 1,
    },
  );
  const contactId = search.ok ? search.data.results?.[0]?.id : undefined;
  if (!contactId) return null;

  const assoc = await apiGet<{ results?: { toObjectId?: string; id?: string }[] }>(
    hs(`/crm/v3/objects/contacts/${contactId}/associations/deals`),
    hubspotHeaders(),
  );
  const first = assoc.ok ? assoc.data.results?.[0] : undefined;
  return (first?.toObjectId ?? first?.id) ?? null;
}

/**
 * Resolve the attributed human owner for a prospect thread.
 *
 * @param prospectEmail the prospect's email address (used to find the deal)
 * @param dealId        optional known HubSpot deal id (skips the email search)
 */
export async function resolveOwner(
  prospectEmail: string | undefined,
  dealId?: string,
): Promise<OwnerAttribution> {
  // Step 1–2: HubSpot deal owner (only if a token is configured).
  if (config.hubspot.accessToken) {
    try {
      const resolvedDealId = dealId ?? (prospectEmail ? await findDealIdByEmail(prospectEmail) : null);
      if (resolvedDealId) {
        const { ownerId } = await getDealOwner(resolvedDealId);
        if (ownerId) {
          const owner = await getOwner(ownerId);
          if (owner) {
            const name = [owner.firstName, owner.lastName].filter(Boolean).join(" ").trim();
            return {
              ownerName: name || owner.email || null,
              ownerEmail: owner.email ?? null,
              dealId: resolvedDealId,
              source: "hubspot",
              holdAsDraft: false,
              rationale: "Resolved from HubSpot deal owner.",
            };
          }
        }
        // Deal exists but has no owner assigned → fall through to fallback.
        return applyFallback(resolvedDealId, "HubSpot deal found but no owner assigned.");
      }
    } catch (err) {
      // Never let a HubSpot outage send mail under the wrong name — fall back
      // to the safe (hold-as-draft) path and record why.
      return applyFallback(
        dealId ?? null,
        `HubSpot lookup failed (${(err as Error).message}); using fallback.`,
      );
    }
  }

  return applyFallback(dealId ?? null, prospectEmail
    ? "No HubSpot deal found for prospect."
    : "No prospect email or deal id provided.");
}

/** Section 6 fallback: configurable default owner, else hold as draft. */
function applyFallback(dealId: string | null, why: string): OwnerAttribution {
  const def = config.raven.defaultOwnerOnUnassigned.trim();
  if (def) {
    return {
      ownerName: def,
      ownerEmail: null,
      dealId,
      source: "default",
      holdAsDraft: false,
      rationale: `${why} Defaulting to DEFAULT_OWNER_ON_UNASSIGNED="${def}".`,
    };
  }
  return {
    ownerName: null,
    ownerEmail: null,
    dealId,
    source: "unassigned",
    holdAsDraft: config.raven.holdUnassignedAsDraft,
    rationale: `${why} No default owner configured — holding as unsigned draft (§6, pending Mark's decision).`,
  };
}
