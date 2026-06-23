import { resolveStepText, type ConsoleEntry, type NetworkFailure, type Step } from "@repruvia/shared";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StepNumber } from "@/components/atoms/StepNumber";
import { StepThumbnail } from "@/components/atoms/StepThumbnail";
import { InlineEditable } from "@/components/molecules/InlineEditable";
import { AiRefineButton } from "@/components/molecules/AiRefineButton";
import { ReactComponentBadge } from "@/components/molecules/ReactComponentBadge";
import { StepErrors } from "@/components/molecules/StepErrors";

interface StepCardProps {
  step: Step;
  console: ConsoleEntry[];
  network: NetworkFailure[];
  isFirst: boolean;
  isLast: boolean;
  onEdit: (description: string) => void;
  onDelete: () => void;
  onMove: (direction: "up" | "down") => void;
}

export function StepCard({
  step,
  console,
  network,
  isFirst,
  isLast,
  onEdit,
  onDelete,
  onMove,
}: StepCardProps) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
        <div className="w-full sm:w-64 sm:shrink-0">
          <StepThumbnail
            src={step.screenshot}
            alt={`Step ${step.index} screenshot`}
            label={`Step ${step.index}`}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex items-start gap-2">
              <StepNumber index={step.index} />
              <div className="min-w-0 flex-1">
                <InlineEditable
                  value={resolveStepText(step)}
                  ariaLabel={`Edit step ${step.index} description`}
                  onCommit={onEdit}
                />
              </div>
              <div className="flex shrink-0 gap-1">
                <AiRefineButton
                  field="step"
                  text={resolveStepText(step)}
                  onResult={onEdit}
                  label={`Refine step ${step.index} with AI`}
                  className="size-9"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Move step up"
                  disabled={isFirst}
                  onClick={() => onMove("up")}
                >
                  <ChevronUp />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Move step down"
                  disabled={isLast}
                  onClick={() => onMove("down")}
                >
                  <ChevronDown />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete step"
                  onClick={onDelete}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 />
                </Button>
              </div>
            </div>

            {step.reactComponent && (
              <div className="pl-9">
                <ReactComponentBadge info={step.reactComponent} />
              </div>
            )}

            <div className="mt-auto pt-1">
              <StepErrors console={console} network={network} />
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
