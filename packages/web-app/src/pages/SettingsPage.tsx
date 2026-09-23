import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Blocks, CircleUserRound, Sparkles, User, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  AiSection,
  IntegrationsSection,
  ProfileSection,
} from "@/components/organisms/SettingsSections";
import { AccountSection } from "@/components/organisms/AccountSection";
import { PageContainer } from "@/components/atoms/PageContainer";
import { useSettings } from "@/hooks/useSettings";
import { useAuth } from "@/hooks/auth";
import { useTicketHistory } from "@/hooks/useTicketHistory";
import { cn } from "@/lib/utils";

type SectionId = "account" | "profile" | "integrations" | "ai";

const SECTIONS: { id: SectionId; label: string; description: string; icon: LucideIcon }[] = [
  {
    id: "account",
    label: "Account",
    description: "Sign in, syncing, and your ticket history",
    icon: CircleUserRound,
  },
  { id: "profile", label: "Profile", description: "The name shown on your reports", icon: User },
  { id: "integrations", label: "Integrations", description: "Connect Linear and Jira", icon: Blocks },
  { id: "ai", label: "AI", description: "Choose the AI that drafts your reports", icon: Sparkles },
];

export function SettingsPage() {
  const { settings, update, persist } = useSettings();
  const [params] = useSearchParams();
  const [active, setActive] = useState<SectionId>(() =>
    SECTIONS.some((s) => s.id === params.get("section"))
      ? (params.get("section") as SectionId)
      : "profile",
  );
  const { status, user, signIn, signOut } = useAuth();
  const history = useTicketHistory(user?.uid ?? null);

  const save = () => {
    persist();
    toast.success("Settings saved");
  };

  const current = SECTIONS.find((s) => s.id === active)!;

  return (
    <PageContainer className="flex flex-col gap-6 py-8">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Your API keys and tokens stay in this browser. They are only ever sent to the service
          they belong to.
        </p>
      </div>

      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        <nav className="flex shrink-0 gap-1 overflow-x-auto md:w-56 md:flex-col md:overflow-visible">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            const selected = section.id === active;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setActive(section.id)}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors",
                  selected ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
                )}
              >
                <Icon className={cn("size-4 shrink-0", selected && "text-primary")} />
                {section.label}
              </button>
            );
          })}
        </nav>

        <div className="min-w-0 flex-1">
          <Card>
            <CardHeader>
              <CardTitle>{current.label}</CardTitle>
              <CardDescription>{current.description}</CardDescription>
            </CardHeader>
            <Separator />
            <CardContent>
              {active === "account" && (
                <AccountSection
                  status={status}
                  displayName={user?.displayName ?? null}
                  email={user?.email ?? null}
                  tickets={history.tickets}
                  historyStatus={history.status}
                  historyError={history.error}
                  onSignIn={() => void signIn()}
                  onSignOut={() => void signOut()}
                  onRefresh={() => void history.refresh()}
                />
              )}
              {active === "profile" && <ProfileSection settings={settings} update={update} />}
              {active === "integrations" && (
                <IntegrationsSection settings={settings} update={update} />
              )}
              {active === "ai" && <AiSection settings={settings} update={update} />}
            </CardContent>
          </Card>

          {active !== "account" && (
            <div className="mt-4 flex justify-end">
              <Button onClick={save}>Save settings</Button>
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
