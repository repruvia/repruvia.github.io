import { useState } from "react";
import { Blocks, Sparkles, User, type LucideIcon } from "lucide-react";
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
import { PageContainer } from "@/components/atoms/PageContainer";
import { useSettings } from "@/hooks/useSettings";
import { cn } from "@/lib/utils";

type SectionId = "profile" | "integrations" | "ai";

const SECTIONS: { id: SectionId; label: string; description: string; icon: LucideIcon }[] = [
  { id: "profile", label: "Profile", description: "Your reporter identity", icon: User },
  { id: "integrations", label: "Integrations", description: "Linear & Jira credentials", icon: Blocks },
  { id: "ai", label: "AI", description: "On-device model & preferences", icon: Sparkles },
];

export function SettingsPage() {
  const { settings, update, persist } = useSettings();
  const [active, setActive] = useState<SectionId>("profile");

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
          Credentials are stored only in this browser and sent only to the respective service.
        </p>
      </div>

      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        {/* Left: section list */}
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

        {/* Right: selected section */}
        <div className="min-w-0 flex-1">
          <Card>
            <CardHeader>
              <CardTitle>{current.label}</CardTitle>
              <CardDescription>{current.description}</CardDescription>
            </CardHeader>
            <Separator />
            <CardContent>
              {active === "profile" && <ProfileSection settings={settings} update={update} />}
              {active === "integrations" && (
                <IntegrationsSection settings={settings} update={update} />
              )}
              {active === "ai" && <AiSection settings={settings} update={update} />}
            </CardContent>
          </Card>

          <div className="mt-4 flex justify-end">
            <Button onClick={save}>Save settings</Button>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
