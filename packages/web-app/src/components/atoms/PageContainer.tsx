import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared page width + horizontal padding so every page and the header align to
 * the same column. Pass layout (flex/gap/py) via `className`.
 */
export function PageContainer({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("mx-auto w-full max-w-5xl px-4", className)}>{children}</div>;
}
