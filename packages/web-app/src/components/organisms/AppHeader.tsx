import { Link } from "react-router-dom";
import { Github, Settings, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/atoms/PageContainer";
import { ThemeToggle } from "@/components/molecules/ThemeToggle";
import { GITHUB_REPO, GITHUB_URL } from "@/lib/links";
import { formatStarCount, useGithubStars } from "@/hooks/useGithubStars";

export function AppHeader() {
  const stars = useGithubStars(GITHUB_REPO);
  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-background/70 backdrop-blur-md">
      <PageContainer className="flex items-center justify-between py-3">
        <Link to="/" className="flex items-center gap-2">
          <img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" className="size-8" />
          <span className="font-display text-lg font-bold tracking-tight">Repruvia</span>
        </Link>
        <div className="flex items-center gap-1">
          <Button asChild variant="outline" size="sm">
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" aria-label="Star Repruvia on GitHub">
              <Github />
              <span className="hidden sm:inline">Star</span>
              {stars !== null && (
                <span className="flex items-center gap-1 border-l border-border pl-2 text-muted-foreground">
                  <Star className="size-3.5 fill-current text-primary" />
                  {formatStarCount(stars)}
                </span>
              )}
            </a>
          </Button>
          <ThemeToggle />
          <Button asChild variant="ghost" size="sm">
            <Link to="/settings">
              <Settings /> <span className="hidden sm:inline">Settings</span>
            </Link>
          </Button>
        </div>
      </PageContainer>
    </header>
  );
}
