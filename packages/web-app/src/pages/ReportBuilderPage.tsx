import { useMemo, useState } from "react";
import type { Report } from "@repruvia/shared";
import { PageContainer } from "@/components/atoms/PageContainer";
import { StateScreen } from "@/components/molecules/StateScreen";
import { ReportBuilderSkeleton } from "@/components/molecules/ReportBuilderSkeleton";
import { ReportHeader } from "@/components/organisms/ReportHeader";
import { AiAssistCard } from "@/components/organisms/AiAssistCard";
import { ReportTabs } from "@/components/organisms/ReportTabs";
import { SubmitBar } from "@/components/organisms/SubmitBar";
import { SubmitDialog } from "@/components/organisms/SubmitDialog";
import { useReportEditor } from "@/hooks/useReportEditor";
import { useSessionId, useSessionLoader } from "@/hooks/useSessionLoader";
import { useReportActions } from "@/hooks/useReportActions";
import type { ProviderId } from "@/lib/integrations/providerRegistry";

export function ReportBuilderPage() {
  const sessionId = useSessionId();
  useSessionLoader(sessionId);

  const editor = useReportEditor();
  const { session, meta, status, error, actions } = editor;

  const report: Report | null = useMemo(
    () => (session ? { session, meta } : null),
    [session, meta],
  );

  const reportActions = useReportActions(report);
  const [submitting, setSubmitting] = useState<ProviderId | null>(null);

  if (!sessionId) {
    return (
      <StateScreen
        title="No session loaded"
        description="Open a recording from the Repruvia extension to build a report."
      />
    );
  }
  if (status === "loading" || status === "idle") {
    return <ReportBuilderSkeleton />;
  }
  if (status === "error" || !session || !report) {
    return <StateScreen title="Couldn't load this session" description={error ?? undefined} />;
  }

  return (
    <PageContainer className="flex flex-col gap-4 py-6">
      <AiAssistCard report={report} />

      <ReportHeader
        meta={meta}
        environment={session.environment}
        onTitleChange={actions.setTitle}
        onDescriptionChange={actions.setDescription}
        onSeverityChange={actions.setSeverity}
      />

      <ReportTabs editor={editor} />

      <SubmitBar actions={reportActions} onSubmit={setSubmitting} />

      <SubmitDialog
        providerId={submitting}
        report={report}
        onClose={() => setSubmitting(null)}
      />
    </PageContainer>
  );
}
