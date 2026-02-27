/**
 * Meta (Facebook) Marketing API client.
 *
 * Covers Campaigns, Ad Sets, Ads, Ad Creatives, Custom Audiences,
 * and the Insights endpoint used for performance reporting.
 *
 * Docs: https://developers.facebook.com/docs/marketing-apis
 */

import { config } from "../config.js";
import { apiGet, apiPost, apiDelete, type ApiResponse } from "../http.js";

// ── Helpers ──────────────────────────────────────────────

function headers() {
  return { Authorization: `Bearer ${config.meta.accessToken}` };
}

function url(path: string, params?: Record<string, string>) {
  const base = `${config.meta.graphBaseUrl}${path}`;
  if (!params) return base;
  const qs = new URLSearchParams(params).toString();
  return `${base}?${qs}`;
}

function adAccountPath(suffix = "") {
  return `/act_${config.meta.adAccountId}${suffix}`;
}

// ── Types ────────────────────────────────────────────────

export interface MetaCampaign {
  id: string;
  name: string;
  status: string;
  objective: string;
  daily_budget?: string;
  lifetime_budget?: string;
  created_time?: string;
  updated_time?: string;
  start_time?: string;
  stop_time?: string;
  special_ad_categories?: string[];
  buying_type?: string;
  bid_strategy?: string;
}

export interface MetaAdSet {
  id: string;
  name: string;
  campaign_id: string;
  status: string;
  daily_budget?: string;
  lifetime_budget?: string;
  bid_amount?: string;
  billing_event?: string;
  optimization_goal?: string;
  targeting?: Record<string, unknown>;
  start_time?: string;
  end_time?: string;
  promoted_object?: Record<string, unknown>;
}

export interface MetaAd {
  id: string;
  name: string;
  adset_id: string;
  campaign_id?: string;
  status: string;
  creative?: { id: string };
  tracking_specs?: Record<string, unknown>[];
}

export interface MetaAdCreative {
  id: string;
  name?: string;
  title?: string;
  body?: string;
  image_url?: string;
  image_hash?: string;
  video_id?: string;
  thumbnail_url?: string;
  link_url?: string;
  call_to_action_type?: string;
  object_story_spec?: Record<string, unknown>;
  asset_feed_spec?: Record<string, unknown>;
}

export interface MetaInsight {
  date_start: string;
  date_stop: string;
  campaign_name?: string;
  adset_name?: string;
  ad_name?: string;
  spend: string;
  impressions: string;
  clicks?: string;
  actions?: { action_type: string; value: string }[];
  cost_per_action_type?: { action_type: string; value: string }[];
  action_values?: { action_type: string; value: string }[];
  conversions?: { action_type: string; value: string }[];
  purchase_roas?: { action_type: string; value: string }[];
  frequency?: string;
  reach?: string;
}

export interface MetaCustomAudience {
  id: string;
  name: string;
  subtype: string;
  description?: string;
  approximate_count?: number;
  data_source?: Record<string, unknown>;
  delivery_status?: Record<string, unknown>;
}

// ── Campaigns ────────────────────────────────────────────

export async function listCampaigns(
  fields?: string,
  filtering?: string,
  limit?: number,
): Promise<ApiResponse> {
  const params: Record<string, string> = {
    fields: fields ?? "id,name,status,objective,daily_budget,lifetime_budget,created_time,bid_strategy",
  };
  if (filtering) params.filtering = filtering;
  if (limit) params.limit = String(limit);
  return apiGet(url(adAccountPath("/campaigns"), params), headers());
}

export async function getCampaign(
  campaignId: string,
  fields?: string,
): Promise<ApiResponse> {
  const params: Record<string, string> = {
    fields: fields ?? "id,name,status,objective,daily_budget,lifetime_budget,created_time,updated_time,start_time,stop_time,bid_strategy,buying_type,special_ad_categories",
  };
  return apiGet(url(`/${campaignId}`, params), headers());
}

export async function createCampaign(data: {
  name: string;
  objective: string;
  status?: string;
  special_ad_categories?: string[];
  daily_budget?: string;
  lifetime_budget?: string;
  bid_strategy?: string;
}): Promise<ApiResponse> {
  return apiPost(url(adAccountPath("/campaigns")), headers(), {
    ...data,
    special_ad_categories: data.special_ad_categories ?? [],
    status: data.status ?? "PAUSED",
  });
}

export async function updateCampaign(
  campaignId: string,
  data: Partial<{
    name: string;
    status: string;
    daily_budget: string;
    lifetime_budget: string;
    bid_strategy: string;
  }>,
): Promise<ApiResponse> {
  return apiPost(url(`/${campaignId}`), headers(), data);
}

export async function deleteCampaign(campaignId: string): Promise<ApiResponse> {
  return apiDelete(url(`/${campaignId}`), headers());
}

// ── Ad Sets ──────────────────────────────────────────────

export async function listAdSets(
  campaignId?: string,
  fields?: string,
  limit?: number,
): Promise<ApiResponse> {
  const params: Record<string, string> = {
    fields: fields ?? "id,name,campaign_id,status,daily_budget,optimization_goal,billing_event,targeting,start_time,end_time",
  };
  if (limit) params.limit = String(limit);
  const path = campaignId
    ? `/${campaignId}/adsets`
    : adAccountPath("/adsets");
  return apiGet(url(path, params), headers());
}

export async function getAdSet(
  adSetId: string,
  fields?: string,
): Promise<ApiResponse> {
  const params: Record<string, string> = {
    fields: fields ?? "id,name,campaign_id,status,daily_budget,lifetime_budget,bid_amount,billing_event,optimization_goal,targeting,start_time,end_time,promoted_object",
  };
  return apiGet(url(`/${adSetId}`, params), headers());
}

export async function createAdSet(data: {
  campaign_id: string;
  name: string;
  optimization_goal: string;
  billing_event: string;
  daily_budget?: string;
  lifetime_budget?: string;
  bid_amount?: string;
  targeting: Record<string, unknown>;
  status?: string;
  start_time?: string;
  end_time?: string;
  promoted_object?: Record<string, unknown>;
}): Promise<ApiResponse> {
  return apiPost(url(adAccountPath("/adsets")), headers(), {
    ...data,
    status: data.status ?? "PAUSED",
  });
}

export async function updateAdSet(
  adSetId: string,
  data: Partial<{
    name: string;
    status: string;
    daily_budget: string;
    lifetime_budget: string;
    bid_amount: string;
    targeting: Record<string, unknown>;
    optimization_goal: string;
    end_time: string;
  }>,
): Promise<ApiResponse> {
  return apiPost(url(`/${adSetId}`), headers(), data);
}

export async function deleteAdSet(adSetId: string): Promise<ApiResponse> {
  return apiDelete(url(`/${adSetId}`), headers());
}

// ── Ads ──────────────────────────────────────────────────

export async function listAds(
  adSetId?: string,
  fields?: string,
  limit?: number,
): Promise<ApiResponse> {
  const params: Record<string, string> = {
    fields: fields ?? "id,name,adset_id,campaign_id,status,creative{id,name,title,body,image_url,thumbnail_url}",
  };
  if (limit) params.limit = String(limit);
  const path = adSetId
    ? `/${adSetId}/ads`
    : adAccountPath("/ads");
  return apiGet(url(path, params), headers());
}

export async function getAd(
  adId: string,
  fields?: string,
): Promise<ApiResponse> {
  const params: Record<string, string> = {
    fields: fields ?? "id,name,adset_id,campaign_id,status,creative{id,name,title,body,image_url,thumbnail_url,link_url,call_to_action_type,object_story_spec},tracking_specs",
  };
  return apiGet(url(`/${adId}`, params), headers());
}

export async function createAd(data: {
  adset_id: string;
  name: string;
  creative: { creative_id: string };
  status?: string;
  tracking_specs?: Record<string, unknown>[];
}): Promise<ApiResponse> {
  return apiPost(url(adAccountPath("/ads")), headers(), {
    ...data,
    status: data.status ?? "PAUSED",
  });
}

export async function updateAd(
  adId: string,
  data: Partial<{
    name: string;
    status: string;
    creative: { creative_id: string };
  }>,
): Promise<ApiResponse> {
  return apiPost(url(`/${adId}`), headers(), data);
}

export async function deleteAd(adId: string): Promise<ApiResponse> {
  return apiDelete(url(`/${adId}`), headers());
}

// ── Ad Creatives ─────────────────────────────────────────

export async function listAdCreatives(
  fields?: string,
  limit?: number,
): Promise<ApiResponse> {
  const params: Record<string, string> = {
    fields: fields ?? "id,name,title,body,image_url,thumbnail_url,link_url,call_to_action_type,object_story_spec",
  };
  if (limit) params.limit = String(limit);
  return apiGet(url(adAccountPath("/adcreatives"), params), headers());
}

export async function createAdCreative(data: {
  name: string;
  object_story_spec: Record<string, unknown>;
  call_to_action_type?: string;
  asset_feed_spec?: Record<string, unknown>;
}): Promise<ApiResponse> {
  return apiPost(url(adAccountPath("/adcreatives")), headers(), data);
}

// ── Custom Audiences ─────────────────────────────────────

export async function listCustomAudiences(
  fields?: string,
  limit?: number,
): Promise<ApiResponse> {
  const params: Record<string, string> = {
    fields: fields ?? "id,name,subtype,description,approximate_count,delivery_status",
  };
  if (limit) params.limit = String(limit);
  return apiGet(url(adAccountPath("/customaudiences"), params), headers());
}

export async function createCustomAudience(data: {
  name: string;
  subtype: string;
  description?: string;
  customer_file_source?: string;
  rule?: Record<string, unknown>;
  lookalike_spec?: Record<string, unknown>;
  pixel_id?: string;
}): Promise<ApiResponse> {
  return apiPost(url(adAccountPath("/customaudiences")), headers(), data);
}

export async function createLookalikeAudience(data: {
  name: string;
  origin_audience_id: string;
  lookalike_spec: {
    type: string;
    country: string;
    ratio: number;
  };
  subtype: string;
}): Promise<ApiResponse> {
  return apiPost(url(adAccountPath("/customaudiences")), headers(), {
    ...data,
    subtype: "LOOKALIKE",
  });
}

// ── Insights (Performance Data) ──────────────────────────

export async function getAccountInsights(params: {
  date_preset?: string;
  time_range?: { since: string; until: string };
  fields?: string;
  level?: string;
  breakdowns?: string;
  filtering?: string;
  time_increment?: string;
  limit?: number;
}): Promise<ApiResponse> {
  const queryParams: Record<string, string> = {
    fields: params.fields ??
      "spend,impressions,actions,cost_per_action_type,action_values,purchase_roas,conversions,reach,frequency",
  };
  if (params.date_preset) queryParams.date_preset = params.date_preset;
  if (params.time_range) queryParams.time_range = JSON.stringify(params.time_range);
  if (params.level) queryParams.level = params.level;
  if (params.breakdowns) queryParams.breakdowns = params.breakdowns;
  if (params.filtering) queryParams.filtering = params.filtering;
  if (params.time_increment) queryParams.time_increment = params.time_increment;
  if (params.limit) queryParams.limit = String(params.limit);
  return apiGet(url(adAccountPath("/insights"), queryParams), headers());
}

export async function getCampaignInsights(
  campaignId: string,
  params: {
    date_preset?: string;
    time_range?: { since: string; until: string };
    fields?: string;
    level?: string;
    time_increment?: string;
  },
): Promise<ApiResponse> {
  const queryParams: Record<string, string> = {
    fields: params.fields ??
      "campaign_name,spend,impressions,actions,cost_per_action_type,action_values,purchase_roas,conversions,reach,frequency",
  };
  if (params.date_preset) queryParams.date_preset = params.date_preset;
  if (params.time_range) queryParams.time_range = JSON.stringify(params.time_range);
  if (params.level) queryParams.level = params.level;
  if (params.time_increment) queryParams.time_increment = params.time_increment;
  return apiGet(url(`/${campaignId}/insights`, queryParams), headers());
}

export async function getAdSetInsights(
  adSetId: string,
  params: {
    date_preset?: string;
    time_range?: { since: string; until: string };
    fields?: string;
    time_increment?: string;
  },
): Promise<ApiResponse> {
  const queryParams: Record<string, string> = {
    fields: params.fields ??
      "adset_name,spend,impressions,actions,cost_per_action_type,action_values,purchase_roas,conversions,reach,frequency",
  };
  if (params.date_preset) queryParams.date_preset = params.date_preset;
  if (params.time_range) queryParams.time_range = JSON.stringify(params.time_range);
  if (params.time_increment) queryParams.time_increment = params.time_increment;
  return apiGet(url(`/${adSetId}/insights`, queryParams), headers());
}

export async function getAdInsights(
  adId: string,
  params: {
    date_preset?: string;
    time_range?: { since: string; until: string };
    fields?: string;
    time_increment?: string;
  },
): Promise<ApiResponse> {
  const queryParams: Record<string, string> = {
    fields: params.fields ??
      "ad_name,spend,impressions,actions,cost_per_action_type,action_values,purchase_roas,conversions,reach,frequency",
  };
  if (params.date_preset) queryParams.date_preset = params.date_preset;
  if (params.time_range) queryParams.time_range = JSON.stringify(params.time_range);
  if (params.time_increment) queryParams.time_increment = params.time_increment;
  return apiGet(url(`/${adId}/insights`, queryParams), headers());
}

// ── Image Upload ─────────────────────────────────────────

export async function uploadAdImage(data: {
  filename: string;
  bytes: string; // base64 encoded
}): Promise<ApiResponse> {
  return apiPost(url(adAccountPath("/adimages")), headers(), data);
}

// ── Pixel ────────────────────────────────────────────────

export async function listPixels(fields?: string): Promise<ApiResponse> {
  const params: Record<string, string> = {
    fields: fields ?? "id,name,code,last_fired_time,is_created_by_business",
  };
  return apiGet(url(adAccountPath("/adspixels"), params), headers());
}

export async function getPixelStats(
  pixelId: string,
  params?: {
    start_time?: string;
    end_time?: string;
    aggregation?: string;
    event?: string;
  },
): Promise<ApiResponse> {
  const queryParams: Record<string, string> = {};
  if (params?.start_time) queryParams.start_time = params.start_time;
  if (params?.end_time) queryParams.end_time = params.end_time;
  if (params?.aggregation) queryParams.aggregation = params.aggregation;
  if (params?.event) queryParams.event = params.event;
  return apiGet(url(`/${pixelId}/stats`, queryParams), headers());
}
