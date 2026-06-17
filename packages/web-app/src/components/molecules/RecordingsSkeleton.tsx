import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder for the recordings library while the extension is being probed. */
export function RecordingsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <section className="flex flex-col gap-3">
      <Skeleton className="h-4 w-40" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: count }).map((_, i) => (
          <Card key={i} className="gap-0 py-0">
            <CardContent className="flex items-start gap-3 px-4 py-3.5">
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-4 w-3/4" />
                <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-3.5 w-20" />
                  <Skeleton className="h-3.5 w-16" />
                </div>
              </div>
              <Skeleton className="size-8 shrink-0 rounded-md" />
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
