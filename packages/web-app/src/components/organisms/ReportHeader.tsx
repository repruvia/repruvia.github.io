import type { Environment, ReportMeta, Severity } from "@repruvia/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SeveritySelect } from "@/components/molecules/SeveritySelect";
import { RichTextEditor } from "@/components/molecules/RichTextEditor";
import { EnvironmentBadges } from "@/components/molecules/EnvironmentBadges";
import { AiRefineButton } from "@/components/molecules/AiRefineButton";

interface ReportHeaderProps {
  meta: ReportMeta;
  environment: Environment;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onSeverityChange: (value: Severity) => void;
}

export function ReportHeader({
  meta,
  environment,
  onTitleChange,
  onDescriptionChange,
  onSeverityChange,
}: ReportHeaderProps) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="report-title">Title</Label>
            <AiRefineButton field="title" text={meta.title} onResult={onTitleChange} />
          </div>
          <Input
            id="report-title"
            value={meta.title}
            placeholder="Short, descriptive bug title"
            onChange={(e) => onTitleChange(e.target.value)}
            className="text-base font-medium"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label>Description</Label>
            <AiRefineButton field="description" text={meta.description} onResult={onDescriptionChange} />
          </div>
          <RichTextEditor
            value={meta.description}
            placeholder="Summarize what went wrong and what you expected…"
            onChange={onDescriptionChange}
          />
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Severity</Label>
            <SeveritySelect value={meta.severity} onChange={onSeverityChange} />
          </div>
          <EnvironmentBadges environment={environment} />
        </div>
      </CardContent>
    </Card>
  );
}
