import { Skeleton } from "@/components/ui/skeleton";

export default function AdminCoordinatorsLoading() {
  return (
    <div className="space-y-6 px-6 py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Skeleton className="h-3 w-12" />
          <Skeleton className="mt-2 h-8 w-44" />
          <Skeleton className="mt-3 h-4 w-72" />
        </div>
        <Skeleton variant="block" className="h-10 w-44 rounded-md" />
      </div>
      <div className="rounded-lg border border-border bg-canvas-card overflow-hidden">
        <Skeleton variant="block" className="h-9 w-full rounded-none" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-border/60 px-3 py-3 last:border-0">
            <Skeleton variant="circle" className="h-7 w-7" />
            <Skeleton className="h-4 w-36" />
            <div className="ml-auto flex gap-6">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-12" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
