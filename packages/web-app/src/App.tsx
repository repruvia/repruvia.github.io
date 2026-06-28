import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppHeader } from "@/components/organisms/AppHeader";
import { AppFooter } from "@/components/organisms/AppFooter";
import { Toaster } from "@/components/ui/sonner";
import { ReportBuilderSkeleton } from "@/components/molecules/ReportBuilderSkeleton";
import { ThemeProvider } from "@/lib/theme";
import { HomePage } from "@/pages/HomePage";
import { SettingsPage } from "@/pages/SettingsPage";
import { useSessionId } from "@/hooks/useSessionLoader";
import { useSnapshotId } from "@/hooks/useSnapshotLoader";

// Lazy-loaded: keeps TipTap + markdown rendering out of the initial bundle (loads when a recording opens).
const ReportBuilderPage = lazy(() =>
  import("@/pages/ReportBuilderPage").then((m) => ({ default: m.ReportBuilderPage })),
);

// Lazy-loaded: keeps Konva (canvas) out of the initial bundle (loads when a snapshot opens).
const AnnotationPage = lazy(() =>
  import("@/pages/AnnotationPage").then((m) => ({ default: m.AnnotationPage })),
);

// Root route: annotation editor for `?snapshot=`, report builder for `?session=`, else landing.
// All three share `/`, distinguished only by query string (read via router hooks) — see CLAUDE.md routing note.
function RootRoute() {
  const snapshotId = useSnapshotId();
  const sessionId = useSessionId();
  if (snapshotId) {
    return (
      <Suspense fallback={<ReportBuilderSkeleton />}>
        <AnnotationPage />
      </Suspense>
    );
  }
  if (!sessionId) return <HomePage />;
  return (
    <Suspense fallback={<ReportBuilderSkeleton />}>
      <ReportBuilderPage />
    </Suspense>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <div className="flex min-h-screen flex-col">
          <AppHeader />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<RootRoute />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </main>
          <AppFooter />
        </div>
        <Toaster />
      </BrowserRouter>
    </ThemeProvider>
  );
}
