import type { PortfolioSnapshot } from "../../domain/portfolio/types";
import type { Language } from "../../ui/i18n";
import { buildLocalApiUrl } from "../http/buildLocalApiUrl";

interface GroqAdvisorResponse {
  source: "groq" | "local-fallback";
  providerStatus: "ok" | "missing_key" | "quota_exceeded" | "provider_error";
  model?: string;
  error?: string;
  text: string;
}

export const requestGroqAdvisorResponse = async (
  question: string,
  snapshot: PortfolioSnapshot,
  language: Language
): Promise<GroqAdvisorResponse> => {
  const response = await fetch(buildLocalApiUrl("/analytics/chat"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, snapshot, language })
  });

  if (!response.ok) {
    throw new Error(`Groq local API returned ${response.status}`);
  }

  return response.json() as Promise<GroqAdvisorResponse>;
};
