/**
 * Configuration loaded from environment variables.
 * Copy .env.example to .env and fill in your credentials.
 */
export const config = {
  karbon: {
    accessKey: process.env.KARBON_ACCESS_KEY ?? "",
    bearerToken: process.env.KARBON_BEARER_TOKEN ?? "",
    baseUrl: "https://api.karbonhq.com/v3",
  },
  microsoft: {
    clientId: process.env.MICROSOFT_CLIENT_ID ?? "",
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET ?? "",
    tenantId: process.env.MICROSOFT_TENANT_ID ?? "",
    accessToken: process.env.MICROSOFT_ACCESS_TOKEN ?? "",
    refreshToken: process.env.MICROSOFT_REFRESH_TOKEN ?? "",
    graphBaseUrl: "https://graph.microsoft.com/v1.0",
    tokenUrl: "https://login.microsoftonline.com",
  },
  meta: {
    accessToken: process.env.META_ACCESS_TOKEN ?? "",
    adAccountId: process.env.META_AD_ACCOUNT_ID ?? "",
    graphBaseUrl: `https://graph.facebook.com/${process.env.META_API_VERSION ?? "v21.0"}`,
    pixelId: process.env.META_PIXEL_ID ?? "",
    pageId: process.env.META_PAGE_ID ?? "",
  },
  canva: {
    accessToken: process.env.CANVA_ACCESS_TOKEN ?? "",
    baseUrl: "https://api.canva.com/rest/v1",
  },
} as const;
