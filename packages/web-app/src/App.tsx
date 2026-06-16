import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppHeader } from "@/components/organisms/AppHeader";
import { Toaster } from "@/components/ui/sonner";
import { StateScreen } from "@/components/molecules/StateScreen";
import { ThemeProvider } from "@/lib/theme";
import { HomePage } from "@/pages/HomePage";
import { SettingsPage } from "@/pages/SettingsPage";
import { useSessionId } from "@/hooks/useSessionLoader";

// Lazy-loaded: the report builder pulls in the rich-text editor (TipTap) and
// markdown rendering, which the landing page doesn't need. Keeps the initial
// bundle light; this code loads only when a recording is opened.
const ReportBuilderPage = lazy(() =>
  import("@/pages/ReportBuilderPage").then((m) => ({ default: m.ReportBuilderPage })),
);

/** Root route: the report builder when a `?session=` is present, else the landing page. */
function RootRoute() {
  if (!useSessionId()) return <HomePage />;
  return (
    <Suspense fallback={<StateScreen loading title="Loading report…" />}>
      <ReportBuilderPage />
    </Suspense>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <div className="min-h-screen">
          <AppHeader />
          <main>
            <Routes>
              <Route path="/" element={<RootRoute />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </main>
        </div>
        <Toaster />
      </BrowserRouter>
    </ThemeProvider>
  );
}
