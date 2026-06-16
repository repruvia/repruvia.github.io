import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { JiraIcon, LinearIcon } from "@/components/atoms/BrandIcons";
import { AI_MODELS, type AppSettings } from "@/lib/settings";

interface SectionProps {
  settings: AppSettings;
  update: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}

function Field({
  id,
  label,
  children,
}: {
  id?: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

export function ProfileSection({ settings, update }: SectionProps) {
  return (
    <div className="flex flex-col gap-5">
      <Field id="reporter-name" label="Display name">
        <Input
          id="reporter-name"
          value={settings.reporterName}
          onChange={(e) => update("reporterName", e.target.value)}
          placeholder="Your name"
        />
      </Field>
      <Field id="reporter-email" label="Email">
        <Input
          id="reporter-email"
          type="email"
          value={settings.reporterEmail}
          onChange={(e) => update("reporterEmail", e.target.value)}
          placeholder="you@company.com"
        />
      </Field>
      <p className="text-xs text-muted-foreground">
        Shown as the reporter on exported and submitted bug reports.
      </p>
    </div>
  );
}

export function IntegrationsSection({ settings, update }: SectionProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
            <LinearIcon className="size-5" style={{ color: "#5E6AD2" }} />
          </span>
          <div>
            <h3 className="font-medium">Linear</h3>
            <p className="text-sm text-muted-foreground">
              Personal API key from Linear → Settings → API.
            </p>
          </div>
        </div>
        <Field id="linear-token" label="API key">
          <Input
            id="linear-token"
            type="password"
            value={settings.linearToken}
            onChange={(e) => update("linearToken", e.target.value)}
            placeholder="lin_api_…"
          />
        </Field>
      </div>

      {/* Full-bleed: cancel CardContent's px-6 and let it stretch edge to edge. */}
      <Separator className="-mx-6 w-auto!" />

      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
            <JiraIcon className="size-5" style={{ color: "#0052CC" }} />
          </span>
          <div>
            <h3 className="font-medium">Jira</h3>
            <p className="text-sm text-muted-foreground">
              Atlassian site, account email, and an API token.
            </p>
          </div>
        </div>
        <Field id="jira-site" label="Site">
          <div className="flex items-center gap-2">
            <Input
              id="jira-site"
              value={settings.jiraSite}
              onChange={(e) => update("jiraSite", e.target.value)}
              placeholder="your-team"
            />
            <span className="shrink-0 text-sm text-muted-foreground">.atlassian.net</span>
          </div>
        </Field>
        <Field id="jira-email" label="Email">
          <Input
            id="jira-email"
            type="email"
            value={settings.jiraEmail}
            onChange={(e) => update("jiraEmail", e.target.value)}
            placeholder="you@company.com"
          />
        </Field>
        <Field id="jira-token" label="API token">
          <Input
            id="jira-token"
            type="password"
            value={settings.jiraToken}
            onChange={(e) => update("jiraToken", e.target.value)}
          />
        </Field>
      </div>
    </div>
  );
}

export function AiSection({ settings, update }: SectionProps) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
        <div>
          <p className="font-medium">Enable AI refine</p>
          <p className="text-sm text-muted-foreground">
            Show the on-device “Refine with AI” action on reports.
          </p>
        </div>
        <Switch
          checked={settings.aiEnabled}
          onCheckedChange={(checked) => update("aiEnabled", checked)}
          aria-label="Enable AI refine"
        />
      </div>

      <Field label="Model">
        <Select
          value={settings.aiModel}
          onValueChange={(value) => update("aiModel", value)}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AI_MODELS.map((model) => (
              <SelectItem key={model.id} value={model.id}>
                {model.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <p className="text-xs text-muted-foreground">
        Runs entirely in your browser via WebGPU — no API key, nothing leaves your device. Larger
        models give better results but take longer to download and run. A model change applies on
        the next page reload.
      </p>
    </div>
  );
}
