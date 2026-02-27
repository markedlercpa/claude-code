/**
 * MCP tool definitions for Canva Connect API.
 *
 * Enables AI-driven ad creative production: create designs from
 * brand templates, autofill copy/images, and export final assets.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as canva from "./client.js";

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });
const json = (d: unknown) => text(JSON.stringify(d, null, 2));
const err = (status: number, data: unknown) =>
  text(`Error ${status}: ${JSON.stringify(data)}`);

export function registerCanvaTools(server: McpServer) {
  // ── Designs ──────────────────────────────────────────────

  server.tool(
    "canva_list_designs",
    "List Canva designs, optionally filtered by search query",
    {
      query: z.string().optional().describe("Search query to filter designs"),
    },
    async ({ query }) => {
      const res = await canva.listDesigns({ query });
      if (!res.ok) return err(res.status, res.data);
      return json(res.data);
    },
  );

  server.tool(
    "canva_get_design",
    "Get details of a specific Canva design including edit/view URLs",
    { designId: z.string().describe("The design ID") },
    async ({ designId }) => {
      const res = await canva.getDesign(designId);
      if (!res.ok) return err(res.status, res.data);
      return json(res.data);
    },
  );

  server.tool(
    "canva_create_design",
    "Create a new blank Canva design",
    {
      title: z.string().optional().describe("Design title"),
      designType: z.string().optional().describe("Design type (e.g. 'Presentation', 'Instagram Post', 'Facebook Ad')"),
    },
    async ({ title, designType }) => {
      const res = await canva.createDesign({
        title,
        design_type: designType,
      });
      if (!res.ok) return err(res.status, res.data);
      return text(`Design created:\n${JSON.stringify(res.data, null, 2)}`);
    },
  );

  // ── Brand Templates & Autofill ───────────────────────────

  server.tool(
    "canva_list_brand_templates",
    "List brand templates available for ad creative generation",
    {
      query: z.string().optional().describe("Search query to filter templates"),
    },
    async ({ query }) => {
      const res = await canva.listBrandTemplates({ query });
      if (!res.ok) return err(res.status, res.data);
      return json(res.data);
    },
  );

  server.tool(
    "canva_get_brand_template",
    "Get details of a brand template including available data fields for autofill",
    { templateId: z.string().describe("Brand template ID") },
    async ({ templateId }) => {
      const [templateRes, datasetRes] = await Promise.allSettled([
        canva.getBrandTemplate(templateId),
        canva.getBrandTemplateDataset(templateId),
      ]);

      const result: Record<string, unknown> = {};
      if (templateRes.status === "fulfilled" && templateRes.value.ok) {
        result.template = templateRes.value.data;
      }
      if (datasetRes.status === "fulfilled" && datasetRes.value.ok) {
        result.dataset = datasetRes.value.data;
      }

      if (Object.keys(result).length === 0) {
        return text("Error: Could not retrieve template details.");
      }
      return json(result);
    },
  );

  server.tool(
    "canva_create_from_template",
    "Create a new design by autofilling a brand template with custom headlines, body copy, and images for ad creatives",
    {
      brandTemplateId: z.string().describe("Brand template ID to use"),
      title: z.string().optional().describe("Title for the new design"),
      dataBindings: z.string().describe("JSON object mapping template field names to values. Each value should have 'type' ('text' or 'image') and corresponding 'text' or 'image_url' or 'asset_id' field."),
    },
    async ({ brandTemplateId, title, dataBindings }) => {
      const res = await canva.createDesignFromTemplate({
        brand_template_id: brandTemplateId,
        title,
        data_bindings: JSON.parse(dataBindings),
      });
      if (!res.ok) return err(res.status, res.data);
      return text(`Autofill job started:\n${JSON.stringify(res.data, null, 2)}`);
    },
  );

  server.tool(
    "canva_check_autofill",
    "Check the status of a template autofill job",
    { jobId: z.string().describe("Autofill job ID") },
    async ({ jobId }) => {
      const res = await canva.getAutofillJob(jobId);
      if (!res.ok) return err(res.status, res.data);
      return json(res.data);
    },
  );

  // ── Exports ──────────────────────────────────────────────

  server.tool(
    "canva_export_design",
    "Export a Canva design as PNG, JPG, PDF, MP4, or GIF for use as ad creative",
    {
      designId: z.string().describe("Design ID to export"),
      format: z.enum(["png", "jpg", "pdf", "mp4", "gif"]).describe("Export format"),
      quality: z.enum(["regular", "high"]).optional().describe("Export quality"),
      width: z.number().optional().describe("Custom width in pixels"),
      height: z.number().optional().describe("Custom height in pixels"),
    },
    async ({ designId, format, quality, width, height }) => {
      const res = await canva.exportDesign({
        design_id: designId,
        format,
        quality,
        width,
        height,
      });
      if (!res.ok) return err(res.status, res.data);
      return text(`Export job started:\n${JSON.stringify(res.data, null, 2)}`);
    },
  );

  server.tool(
    "canva_check_export",
    "Check the status of a design export job and get download URLs",
    { exportId: z.string().describe("Export job ID") },
    async ({ exportId }) => {
      const res = await canva.getExportJob(exportId);
      if (!res.ok) return err(res.status, res.data);
      return json(res.data);
    },
  );

  // ── Asset Uploads ────────────────────────────────────────

  server.tool(
    "canva_upload_asset",
    "Upload an image or video asset to Canva for use in ad creatives",
    {
      name: z.string().describe("Asset name"),
      mediaType: z.enum(["image", "video"]).describe("Asset type"),
      assetUrl: z.string().describe("Public URL of the asset to upload"),
    },
    async ({ name, mediaType, assetUrl }) => {
      const res = await canva.uploadAsset({
        name,
        media_type: mediaType,
        url: assetUrl,
      });
      if (!res.ok) return err(res.status, res.data);
      return text(`Asset upload started:\n${JSON.stringify(res.data, null, 2)}`);
    },
  );

  // ── Folders ──────────────────────────────────────────────

  server.tool(
    "canva_create_folder",
    "Create a Canva folder to organize ad creative assets by campaign or funnel",
    {
      name: z.string().describe("Folder name"),
      parentFolderId: z.string().optional().describe("Parent folder ID (for nested organization)"),
    },
    async ({ name, parentFolderId }) => {
      const res = await canva.createFolder({
        name,
        parent_folder_id: parentFolderId,
      });
      if (!res.ok) return err(res.status, res.data);
      return text(`Folder created:\n${JSON.stringify(res.data, null, 2)}`);
    },
  );
}
