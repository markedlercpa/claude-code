/**
 * MCP tool definitions for Meta (Facebook) Marketing API.
 *
 * Provides full campaign management, audience targeting,
 * creative management, and performance insights.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as meta from "./client.js";

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });
const json = (d: unknown) => text(JSON.stringify(d, null, 2));
const err = (status: number, data: unknown) =>
  text(`Error ${status}: ${JSON.stringify(data)}`);

export function registerMetaAdsTools(server: McpServer) {
  // ── Campaigns ────────────────────────────────────────────

  server.tool(
    "meta_list_campaigns",
    "List all campaigns in the Meta ad account with status, objective, and budget info",
    {
      limit: z.number().optional().describe("Max campaigns to return"),
    },
    async ({ limit }) => {
      const res = await meta.listCampaigns(undefined, undefined, limit);
      if (!res.ok) return err(res.status, res.data);
      return json(res.data);
    },
  );

  server.tool(
    "meta_get_campaign",
    "Get detailed info about a specific Meta campaign",
    { campaignId: z.string().describe("The campaign ID") },
    async ({ campaignId }) => {
      const res = await meta.getCampaign(campaignId);
      if (!res.ok) return err(res.status, res.data);
      return json(res.data);
    },
  );

  server.tool(
    "meta_create_campaign",
    "Create a new Meta ad campaign. Starts PAUSED by default for review before launch.",
    {
      name: z.string().describe("Campaign name"),
      objective: z.enum([
        "OUTCOME_AWARENESS", "OUTCOME_ENGAGEMENT", "OUTCOME_LEADS",
        "OUTCOME_SALES", "OUTCOME_TRAFFIC", "OUTCOME_APP_PROMOTION",
      ]).describe("Campaign objective"),
      dailyBudget: z.string().optional().describe("Daily budget in cents (e.g. '5000' = $50.00)"),
      lifetimeBudget: z.string().optional().describe("Lifetime budget in cents"),
      bidStrategy: z.enum([
        "LOWEST_COST_WITHOUT_CAP", "LOWEST_COST_WITH_BID_CAP",
        "COST_CAP", "LOWEST_COST_WITH_MIN_ROAS",
      ]).optional().describe("Bid strategy"),
      specialAdCategories: z.array(z.string()).optional().describe("Special ad categories if applicable"),
    },
    async (params) => {
      const res = await meta.createCampaign({
        name: params.name,
        objective: params.objective,
        daily_budget: params.dailyBudget,
        lifetime_budget: params.lifetimeBudget,
        bid_strategy: params.bidStrategy,
        special_ad_categories: params.specialAdCategories,
      });
      if (!res.ok) return err(res.status, res.data);
      return text(`Campaign created:\n${JSON.stringify(res.data, null, 2)}`);
    },
  );

  server.tool(
    "meta_update_campaign",
    "Update an existing Meta campaign (name, status, budget, bid strategy)",
    {
      campaignId: z.string().describe("Campaign ID to update"),
      name: z.string().optional().describe("New name"),
      status: z.enum(["ACTIVE", "PAUSED", "ARCHIVED"]).optional().describe("New status"),
      dailyBudget: z.string().optional().describe("New daily budget in cents"),
      bidStrategy: z.string().optional().describe("New bid strategy"),
    },
    async ({ campaignId, ...updates }) => {
      const data: Record<string, string> = {};
      if (updates.name) data.name = updates.name;
      if (updates.status) data.status = updates.status;
      if (updates.dailyBudget) data.daily_budget = updates.dailyBudget;
      if (updates.bidStrategy) data.bid_strategy = updates.bidStrategy;
      const res = await meta.updateCampaign(campaignId, data);
      if (!res.ok) return err(res.status, res.data);
      return text(`Campaign updated:\n${JSON.stringify(res.data, null, 2)}`);
    },
  );

  // ── Ad Sets ──────────────────────────────────────────────

  server.tool(
    "meta_list_adsets",
    "List ad sets, optionally filtered by campaign",
    {
      campaignId: z.string().optional().describe("Filter by campaign ID"),
      limit: z.number().optional().describe("Max ad sets to return"),
    },
    async ({ campaignId, limit }) => {
      const res = await meta.listAdSets(campaignId, undefined, limit);
      if (!res.ok) return err(res.status, res.data);
      return json(res.data);
    },
  );

  server.tool(
    "meta_get_adset",
    "Get detailed info about a specific ad set including targeting",
    { adSetId: z.string().describe("The ad set ID") },
    async ({ adSetId }) => {
      const res = await meta.getAdSet(adSetId);
      if (!res.ok) return err(res.status, res.data);
      return json(res.data);
    },
  );

  server.tool(
    "meta_create_adset",
    "Create a new ad set with targeting, budget, and optimization settings",
    {
      campaignId: z.string().describe("Parent campaign ID"),
      name: z.string().describe("Ad set name"),
      optimizationGoal: z.string().describe("e.g. OFFSITE_CONVERSIONS, LEAD_GENERATION, LINK_CLICKS"),
      billingEvent: z.string().describe("e.g. IMPRESSIONS, LINK_CLICKS"),
      dailyBudget: z.string().optional().describe("Daily budget in cents"),
      lifetimeBudget: z.string().optional().describe("Lifetime budget in cents"),
      targeting: z.string().describe("JSON string of targeting spec (age, geo, interests, custom audiences, etc.)"),
      startTime: z.string().optional().describe("Start time ISO 8601"),
      endTime: z.string().optional().describe("End time ISO 8601"),
      promotedObject: z.string().optional().describe("JSON string of promoted object (pixel_id, page_id, etc.)"),
    },
    async (params) => {
      const res = await meta.createAdSet({
        campaign_id: params.campaignId,
        name: params.name,
        optimization_goal: params.optimizationGoal,
        billing_event: params.billingEvent,
        daily_budget: params.dailyBudget,
        lifetime_budget: params.lifetimeBudget,
        targeting: JSON.parse(params.targeting),
        start_time: params.startTime,
        end_time: params.endTime,
        promoted_object: params.promotedObject ? JSON.parse(params.promotedObject) : undefined,
      });
      if (!res.ok) return err(res.status, res.data);
      return text(`Ad set created:\n${JSON.stringify(res.data, null, 2)}`);
    },
  );

  server.tool(
    "meta_update_adset",
    "Update an existing ad set (targeting, budget, status, etc.)",
    {
      adSetId: z.string().describe("Ad set ID to update"),
      name: z.string().optional().describe("New name"),
      status: z.enum(["ACTIVE", "PAUSED", "ARCHIVED"]).optional().describe("New status"),
      dailyBudget: z.string().optional().describe("New daily budget in cents"),
      targeting: z.string().optional().describe("New targeting spec as JSON string"),
      optimizationGoal: z.string().optional().describe("New optimization goal"),
    },
    async ({ adSetId, ...updates }) => {
      const data: Record<string, unknown> = {};
      if (updates.name) data.name = updates.name;
      if (updates.status) data.status = updates.status;
      if (updates.dailyBudget) data.daily_budget = updates.dailyBudget;
      if (updates.targeting) data.targeting = JSON.parse(updates.targeting);
      if (updates.optimizationGoal) data.optimization_goal = updates.optimizationGoal;
      const res = await meta.updateAdSet(adSetId, data);
      if (!res.ok) return err(res.status, res.data);
      return text(`Ad set updated:\n${JSON.stringify(res.data, null, 2)}`);
    },
  );

  // ── Ads ──────────────────────────────────────────────────

  server.tool(
    "meta_list_ads",
    "List ads, optionally filtered by ad set",
    {
      adSetId: z.string().optional().describe("Filter by ad set ID"),
      limit: z.number().optional().describe("Max ads to return"),
    },
    async ({ adSetId, limit }) => {
      const res = await meta.listAds(adSetId, undefined, limit);
      if (!res.ok) return err(res.status, res.data);
      return json(res.data);
    },
  );

  server.tool(
    "meta_create_ad",
    "Create a new ad linking an ad set to a creative. Starts PAUSED for review.",
    {
      adSetId: z.string().describe("Ad set ID"),
      name: z.string().describe("Ad name"),
      creativeId: z.string().describe("Ad creative ID to use"),
    },
    async ({ adSetId, name, creativeId }) => {
      const res = await meta.createAd({
        adset_id: adSetId,
        name,
        creative: { creative_id: creativeId },
      });
      if (!res.ok) return err(res.status, res.data);
      return text(`Ad created:\n${JSON.stringify(res.data, null, 2)}`);
    },
  );

  server.tool(
    "meta_update_ad",
    "Update an existing ad (status, creative, name)",
    {
      adId: z.string().describe("Ad ID to update"),
      name: z.string().optional().describe("New name"),
      status: z.enum(["ACTIVE", "PAUSED", "ARCHIVED"]).optional().describe("New status"),
      creativeId: z.string().optional().describe("New creative ID"),
    },
    async ({ adId, ...updates }) => {
      const data: Record<string, unknown> = {};
      if (updates.name) data.name = updates.name;
      if (updates.status) data.status = updates.status;
      if (updates.creativeId) data.creative = { creative_id: updates.creativeId };
      const res = await meta.updateAd(adId, data);
      if (!res.ok) return err(res.status, res.data);
      return text(`Ad updated:\n${JSON.stringify(res.data, null, 2)}`);
    },
  );

  // ── Ad Creatives ─────────────────────────────────────────

  server.tool(
    "meta_list_creatives",
    "List ad creatives in the ad account",
    { limit: z.number().optional().describe("Max creatives to return") },
    async ({ limit }) => {
      const res = await meta.listAdCreatives(undefined, limit);
      if (!res.ok) return err(res.status, res.data);
      return json(res.data);
    },
  );

  server.tool(
    "meta_create_creative",
    "Create a new ad creative with image/video, copy, CTA, and link",
    {
      name: z.string().describe("Creative name"),
      objectStorySpec: z.string().describe("JSON string: page_id, link_data (image_hash/video_id, message, link, call_to_action)"),
      callToActionType: z.string().optional().describe("e.g. LEARN_MORE, SIGN_UP, SHOP_NOW, BOOK_TRAVEL, DOWNLOAD"),
      assetFeedSpec: z.string().optional().describe("JSON string for dynamic creative testing (multiple headlines, descriptions, images)"),
    },
    async (params) => {
      const res = await meta.createAdCreative({
        name: params.name,
        object_story_spec: JSON.parse(params.objectStorySpec),
        call_to_action_type: params.callToActionType,
        asset_feed_spec: params.assetFeedSpec ? JSON.parse(params.assetFeedSpec) : undefined,
      });
      if (!res.ok) return err(res.status, res.data);
      return text(`Creative created:\n${JSON.stringify(res.data, null, 2)}`);
    },
  );

  // ── Custom Audiences ─────────────────────────────────────

  server.tool(
    "meta_list_audiences",
    "List custom audiences in the ad account",
    { limit: z.number().optional().describe("Max audiences to return") },
    async ({ limit }) => {
      const res = await meta.listCustomAudiences(undefined, limit);
      if (!res.ok) return err(res.status, res.data);
      return json(res.data);
    },
  );

  server.tool(
    "meta_create_audience",
    "Create a custom audience (website visitors, customer list, or engagement-based)",
    {
      name: z.string().describe("Audience name"),
      subtype: z.enum(["CUSTOM", "WEBSITE", "ENGAGEMENT", "LOOKALIKE"]).describe("Audience subtype"),
      description: z.string().optional().describe("Description"),
      rule: z.string().optional().describe("JSON string of audience rule (for website/engagement audiences)"),
      pixelId: z.string().optional().describe("Pixel ID for website audiences"),
    },
    async (params) => {
      const res = await meta.createCustomAudience({
        name: params.name,
        subtype: params.subtype,
        description: params.description,
        rule: params.rule ? JSON.parse(params.rule) : undefined,
        pixel_id: params.pixelId,
      });
      if (!res.ok) return err(res.status, res.data);
      return text(`Audience created:\n${JSON.stringify(res.data, null, 2)}`);
    },
  );

  server.tool(
    "meta_create_lookalike",
    "Create a lookalike audience from a source audience",
    {
      name: z.string().describe("Lookalike audience name"),
      originAudienceId: z.string().describe("Source custom audience ID"),
      country: z.string().describe("Two-letter country code (e.g. 'US')"),
      ratio: z.number().min(0.01).max(0.20).describe("Lookalike ratio (0.01 = 1%, 0.10 = 10%)"),
    },
    async ({ name, originAudienceId, country, ratio }) => {
      const res = await meta.createLookalikeAudience({
        name,
        origin_audience_id: originAudienceId,
        subtype: "LOOKALIKE",
        lookalike_spec: { type: "similarity", country, ratio },
      });
      if (!res.ok) return err(res.status, res.data);
      return text(`Lookalike audience created:\n${JSON.stringify(res.data, null, 2)}`);
    },
  );

  // ── Insights ─────────────────────────────────────────────

  server.tool(
    "meta_account_insights",
    "Get performance insights for the entire ad account. Use for high-level CAC and ROAS analysis.",
    {
      datePreset: z.string().optional().describe("e.g. today, yesterday, last_7d, last_30d, this_month, last_month"),
      since: z.string().optional().describe("Start date YYYY-MM-DD (use instead of datePreset)"),
      until: z.string().optional().describe("End date YYYY-MM-DD"),
      level: z.enum(["account", "campaign", "adset", "ad"]).optional().describe("Breakdown level"),
      timeIncrement: z.string().optional().describe("'1' for daily, '7' for weekly, 'monthly', or 'all_days'"),
    },
    async (params) => {
      const res = await meta.getAccountInsights({
        date_preset: params.datePreset,
        time_range: params.since && params.until ? { since: params.since, until: params.until } : undefined,
        level: params.level,
        time_increment: params.timeIncrement,
      });
      if (!res.ok) return err(res.status, res.data);
      return json(res.data);
    },
  );

  server.tool(
    "meta_campaign_insights",
    "Get performance insights for a specific campaign",
    {
      campaignId: z.string().describe("Campaign ID"),
      datePreset: z.string().optional().describe("e.g. last_7d, last_30d"),
      since: z.string().optional().describe("Start date YYYY-MM-DD"),
      until: z.string().optional().describe("End date YYYY-MM-DD"),
      level: z.enum(["campaign", "adset", "ad"]).optional().describe("Breakdown level"),
      timeIncrement: z.string().optional().describe("'1' for daily, '7' for weekly"),
    },
    async ({ campaignId, ...params }) => {
      const res = await meta.getCampaignInsights(campaignId, {
        date_preset: params.datePreset,
        time_range: params.since && params.until ? { since: params.since, until: params.until } : undefined,
        level: params.level,
        time_increment: params.timeIncrement,
      });
      if (!res.ok) return err(res.status, res.data);
      return json(res.data);
    },
  );

  server.tool(
    "meta_adset_insights",
    "Get performance insights for a specific ad set",
    {
      adSetId: z.string().describe("Ad set ID"),
      datePreset: z.string().optional().describe("e.g. last_7d, last_30d"),
      since: z.string().optional().describe("Start date YYYY-MM-DD"),
      until: z.string().optional().describe("End date YYYY-MM-DD"),
    },
    async ({ adSetId, ...params }) => {
      const res = await meta.getAdSetInsights(adSetId, {
        date_preset: params.datePreset,
        time_range: params.since && params.until ? { since: params.since, until: params.until } : undefined,
      });
      if (!res.ok) return err(res.status, res.data);
      return json(res.data);
    },
  );

  server.tool(
    "meta_ad_insights",
    "Get performance insights for a specific ad",
    {
      adId: z.string().describe("Ad ID"),
      datePreset: z.string().optional().describe("e.g. last_7d, last_30d"),
      since: z.string().optional().describe("Start date YYYY-MM-DD"),
      until: z.string().optional().describe("End date YYYY-MM-DD"),
    },
    async ({ adId, ...params }) => {
      const res = await meta.getAdInsights(adId, {
        date_preset: params.datePreset,
        time_range: params.since && params.until ? { since: params.since, until: params.until } : undefined,
      });
      if (!res.ok) return err(res.status, res.data);
      return json(res.data);
    },
  );

  // ── Pixel ────────────────────────────────────────────────

  server.tool(
    "meta_list_pixels",
    "List tracking pixels in the ad account",
    {},
    async () => {
      const res = await meta.listPixels();
      if (!res.ok) return err(res.status, res.data);
      return json(res.data);
    },
  );

  server.tool(
    "meta_pixel_stats",
    "Get event stats for a Meta pixel (track conversions, purchases, leads)",
    {
      pixelId: z.string().describe("Pixel ID"),
      startTime: z.string().optional().describe("Start time (ISO 8601 or Unix timestamp)"),
      endTime: z.string().optional().describe("End time"),
      event: z.string().optional().describe("Specific event to filter (e.g. Purchase, Lead, AddToCart)"),
    },
    async ({ pixelId, startTime, endTime, event }) => {
      const res = await meta.getPixelStats(pixelId, {
        start_time: startTime,
        end_time: endTime,
        event,
      });
      if (!res.ok) return err(res.status, res.data);
      return json(res.data);
    },
  );
}
