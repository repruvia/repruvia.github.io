import { PageContainer } from "@/components/atoms/PageContainer";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder mirroring the report builder layout while a session loads. */
export function ReportBuilderSkeleton() {
  return (
    <PageContainer className="flex flex-col gap-4 py-6">
      {/* AI assist card */}
      <Skeleton className="h-20 w-full rounded-xl" />

      {/* Report header */}
      <Card>
        <CardContent className="flex flex-col gap-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>

      {/* Tabs bar */}
      <div className="flex gap-2">
        <Skeleton className="h-9 w-24 rounded-lg" />
        <Skeleton className="h-9 w-32 rounded-lg" />
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>

      {/* Step cards */}
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
            <Skeleton className="aspect-video w-full sm:w-64 sm:shrink-0" />
            <div className="flex flex-1 flex-col gap-2">
              <div className="flex items-center gap-2">
                <Skeleton className="size-6 shrink-0 rounded-full" />
                <Skeleton className="h-5 w-3/5" />
              </div>
              <Skeleton className="h-4 w-4/5" />
            </div>
          </CardContent>
        </Card>
      ))}
    </PageContainer>
  );
}
