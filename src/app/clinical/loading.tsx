import { Skeleton } from "@/components/ui/skeleton";

export default function ClinicalLoading() {
  return (
    <div className="space-y-6 px-6 py-6">
      <div>
        <Skeleton className="h-3 w-16" />
        <Skeleton className="mt-2 h-8 w-44" />
        <Skeleton className="mt-3 h-4 w-2/3 max-w-xl" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-canvas-card p-5">
            <div className="flex items-start gap-4">
              <Skeleton variant="circle" className="h-10 w-10" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-3 w-72" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" variant="block" />
            </div>
            <div className="mt-4 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Skeleton className="h-9 w-32 rounded-md" variant="block" />
              <Skeleton className="h-9 w-28 rounded-md" variant="block" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
