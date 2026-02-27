/**
 * Canva Connect API client.
 *
 * Enables creating designs from templates, exporting assets,
 * uploading brand assets, and managing design automation.
 *
 * Docs: https://www.canva.dev/docs/connect/
 */

import { config } from "../config.js";
import { apiGet, apiPost, type ApiResponse } from "../http.js";

// ── Helpers ──────────────────────────────────────────────

function headers() {
  return {
    Authorization: `Bearer ${config.canva.accessToken}`,
  };
}

function url(path: string) {
  return `${config.canva.baseUrl}${path}`;
}

// ── Types ────────────────────────────────────────────────

export interface CanvaDesign {
  id: string;
  title: string;
  owner: { user_id: string; team_id?: string };
  thumbnail?: { url: string; width: number; height: number };
  urls?: { edit_url: string; view_url: string };
  created_at: string;
  updated_at: string;
}

export interface CanvaTemplate {
  id: string;
  title: string;
  thumbnail?: { url: string };
}

export interface CanvaExportJob {
  id: string;
  status: "in_progress" | "success" | "failed";
  urls?: string[];
  error?: { code: string; message: string };
}

export interface CanvaBrandTemplate {
  id: string;
  title: string;
  thumbnail?: { url: string };
  created_at: string;
  updated_at: string;
}

export interface CanvaAssetUpload {
  id: string;
  name: string;
  tags?: string[];
  created_at: string;
}

// ── Designs ──────────────────────────────────────────────

export async function listDesigns(params?: {
  query?: string;
  continuation?: string;
  ownership?: string;
}): Promise<ApiResponse> {
  const qs = new URLSearchParams();
  if (params?.query) qs.set("query", params.query);
  if (params?.continuation) qs.set("continuation", params.continuation);
  if (params?.ownership) qs.set("ownership", params.ownership);
  const suffix = qs.toString() ? `?${qs}` : "";
  return apiGet(url(`/designs${suffix}`), headers());
}

export async function getDesign(designId: string): Promise<ApiResponse> {
  return apiGet(url(`/designs/${designId}`), headers());
}

export async function createDesign(data: {
  design_type?: string;
  title?: string;
  asset_id?: string;
}): Promise<ApiResponse> {
  return apiPost(url("/designs"), headers(), data);
}

export async function createDesignFromTemplate(data: {
  brand_template_id: string;
  title?: string;
  data_bindings?: Record<string, { type: string; text?: string; image_url?: string; asset_id?: string }>;
}): Promise<ApiResponse> {
  return apiPost(url("/autofills"), headers(), data);
}

// ── Autofill (Template Data Binding) ─────────────────────

export async function getAutofillJob(jobId: string): Promise<ApiResponse> {
  return apiGet(url(`/autofills/${jobId}`), headers());
}

// ── Exports ──────────────────────────────────────────────

export async function exportDesign(data: {
  design_id: string;
  format: "png" | "jpg" | "pdf" | "mp4" | "gif";
  quality?: "regular" | "high";
  pages?: number[];
  width?: number;
  height?: number;
}): Promise<ApiResponse> {
  return apiPost(url("/exports"), headers(), {
    design_id: data.design_id,
    format: { type: data.format },
    quality: data.quality,
    pages: data.pages,
    size: data.width ? { width: data.width, height: data.height } : undefined,
  });
}

export async function getExportJob(exportId: string): Promise<ApiResponse> {
  return apiGet(url(`/exports/${exportId}`), headers());
}

// ── Brand Templates ──────────────────────────────────────

export async function listBrandTemplates(params?: {
  query?: string;
  continuation?: string;
}): Promise<ApiResponse> {
  const qs = new URLSearchParams();
  if (params?.query) qs.set("query", params.query);
  if (params?.continuation) qs.set("continuation", params.continuation);
  const suffix = qs.toString() ? `?${qs}` : "";
  return apiGet(url(`/brand-templates${suffix}`), headers());
}

export async function getBrandTemplate(templateId: string): Promise<ApiResponse> {
  return apiGet(url(`/brand-templates/${templateId}`), headers());
}

export async function getBrandTemplateDataset(templateId: string): Promise<ApiResponse> {
  return apiGet(url(`/brand-templates/${templateId}/dataset`), headers());
}

// ── Asset Uploads ────────────────────────────────────────

export async function uploadAsset(data: {
  name: string;
  media_type: "image" | "video";
  url: string;
}): Promise<ApiResponse> {
  return apiPost(url("/asset-uploads"), headers(), {
    name: data.name,
    media_type: data.media_type,
    url: data.url,
  });
}

export async function getAssetUpload(assetUploadId: string): Promise<ApiResponse> {
  return apiGet(url(`/asset-uploads/${assetUploadId}`), headers());
}

// ── Folders ──────────────────────────────────────────────

export async function listFolderItems(folderId: string): Promise<ApiResponse> {
  return apiGet(url(`/folders/${folderId}/items`), headers());
}

export async function createFolder(data: {
  name: string;
  parent_folder_id?: string;
}): Promise<ApiResponse> {
  return apiPost(url("/folders"), headers(), data);
}
