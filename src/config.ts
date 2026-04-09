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
  hubspot: {
    accessToken: process.env.HUBSPOT_ACCESS_TOKEN ?? "",
    baseUrl: "https://api.hubapi.com",
  },
} as const;
