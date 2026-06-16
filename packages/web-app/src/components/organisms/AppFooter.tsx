import { PageContainer } from "@/components/atoms/PageContainer";
import { GITHUB_URL, PRIVACY_URL } from "@/lib/links";

export function AppFooter() {
  return (
    <footer className="mt-12 border-t border-border/60">
      <PageContainer className="flex flex-wrap items-center justify-between gap-3 py-5 text-xs text-muted-foreground">
        <span>Repruvia — bug reports that write themselves. Runs entirely in your browser.</span>
        <span className="flex items-center gap-4">
          <a href={PRIVACY_URL} target="_blank" rel="noreferrer" className="hover:text-foreground">
            Privacy
          </a>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="hover:text-foreground">
            GitHub
          </a>
        </span>
      </PageContainer>
    </footer>
  );
}
