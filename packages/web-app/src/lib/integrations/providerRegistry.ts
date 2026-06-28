import type { TicketProvider } from "@repruvia/shared";
import type { AppSettings } from "@/lib/settings";
import { LinearProvider } from "./linearProvider";
import { JiraProvider } from "./jiraProvider";

export type ProviderId = "linear" | "jira";

/** Adding a provider means one entry here + one class — submission UI is untouched. */
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
