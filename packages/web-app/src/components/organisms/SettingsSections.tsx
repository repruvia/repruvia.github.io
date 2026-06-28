import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { JiraIcon, LinearIcon } from "@/components/atoms/BrandIcons";
import {
  AI_PROVIDER_MODELS,
  type AiProviderConfig,
  type AiProviderId,
  type AppSettings,
} from "@/lib/settings";
import { cn } from "@/lib/utils";

interface SectionProps {
  settings: AppSettings;
  update: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}

/** Live "Connected / Not connected" marker driven by whether creds are filled. */
function ConnectionStatus({ connected }: { connected: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs",
        connected ? "border-primary/30 text-primary" : "text-muted-foreground",
      )}
    >
      <span
        className={cn("size-1.5 rounded-full", connected ? "bg-primary" : "bg-muted-foreground/40")}
      />
      {connected ? "Connected" : "Not connected"}
    </span>
  );
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
  const linearConnected = settings.linearToken.trim().length > 0;
  const jiraConnected = Boolean(
    settings.jiraSite.trim() && settings.jiraEmail.trim() && settings.jiraToken.trim(),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
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
          <ConnectionStatus connected={linearConnected} />
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

      {/* Full-bleed: cancel CardContent's px-6 so it stretches edge to edge. */}
      <Separator className="-mx-6 w-auto!" />

      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
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
          <ConnectionStatus connected={jiraConnected} />
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
  const active = settings.ai.activeProvider;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label>AI provider</Label>
        <Select
          value={active ?? "off"}
          onValueChange={(v) =>
            update("ai", { ...settings.ai, activeProvider: v === "off" ? null : (v as AiProviderId) })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="off">Off</SelectItem>
            <SelectItem value="openai">OpenAI</SelectItem>
            <SelectItem value="anthropic">Anthropic</SelectItem>
            <SelectItem value="gemini">Google Gemini</SelectItem>
            <SelectItem value="grok">xAI Grok</SelectItem>
            <SelectItem value="groq">Groq</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {active && (
        <ProviderConfig
          provider={active}
          config={settings.ai.providers[active]}
          onChange={(next) =>
            update("ai", {
              ...settings.ai,
              providers: { ...settings.ai.providers, [active]: next },
            })
          }
        />
      )}

      <p className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        Choosing a provider sends report text — and, when refining a step or generating from a
        snapshot, that screenshot — to that provider&apos;s API. API keys are stored locally in your
        browser. AI is off until you pick and configure a provider.
      </p>
    </div>
  );
}

function ProviderConfig({
  provider,
  config,
  onChange,
}: {
  provider: AiProviderId;
  config: AiProviderConfig;
  onChange: (next: AiProviderConfig) => void;
}) {
  const models = AI_PROVIDER_MODELS[provider];
  const isCustom = !models.some((m) => m.id === config.model);
  return (
    <div className="flex flex-col gap-4 rounded-md border p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ai-key">API key</Label>
        <Input
          id="ai-key"
          type="password"
          value={config.apiKey ?? ""}
          placeholder="Paste your API key"
          onChange={(e) => onChange({ ...config, apiKey: e.target.value })}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Model</Label>
        <Select
          value={isCustom ? "custom" : config.model}
          onValueChange={(v) => onChange({ ...config, model: v === "custom" ? "" : v })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {models.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.label}
              </SelectItem>
            ))}
            <SelectItem value="custom">Custom…</SelectItem>
          </SelectContent>
        </Select>
        {isCustom && (
          <Input
            value={config.model}
            placeholder="Custom model id"
            onChange={(e) => onChange({ ...config, model: e.target.value })}
          />
        )}
      </div>
    </div>
  );
}
