import { appConfig } from "../../app/config";

export const buildLocalApiUrl = (
  path: string,
  params: Record<string, string | number | boolean | null | undefined> = {}
): string => {
  const baseUrl = (appConfig.apiBaseUrl || "/api").replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${baseUrl}${normalizedPath}`, window.location.origin);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
};
