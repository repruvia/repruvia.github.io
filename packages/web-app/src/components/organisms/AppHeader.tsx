import { Link } from "react-router-dom";
import { Github, Settings, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/atoms/PageContainer";
import { ThemeToggle } from "@/components/molecules/ThemeToggle";

const GITHUB_URL = "https://github.com/leoAnimesh/repruvia";

export function AppHeader() {
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
              <Star className="hidden sm:inline" />
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
