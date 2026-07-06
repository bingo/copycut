export function getAppOrigin(requestUrl: string): string {
  const configured = process.env.APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const vercelUrl =
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ?? process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    return `https://${vercelUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
  }

  return new URL(requestUrl).origin;
}
