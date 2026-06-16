import type { TicketProvider } from "@repruvia/shared";
import type { AppSettings } from "@/lib/settings";
import { LinearProvider } from "./linearProvider";
import { JiraProvider } from "./jiraProvider";

export type ProviderId = "linear" | "jira";

/**
 * Builds the configured `TicketProvider` instances from settings. Adding a new
 * provider means adding one case here and one class — submission UI is untouched.
 */
export function buildProviders(settings: AppSettings): Record<ProviderId, TicketProvider> {
  return {
    linear: new LinearProvider(settings.linearToken),
    jira: new JiraProvider({
      site: settings.jiraSite,
      email: settings.jiraEmail,
      apiToken: settings.jiraToken,
    }),
  };
}
