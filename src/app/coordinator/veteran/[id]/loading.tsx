import { Skeleton } from "@/components/ui/skeleton";

export default function VeteranTimelineLoading() {
  return (
    <div className="px-6 py-6">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Skeleton variant="circle" className="h-12 w-12" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-8 w-56" />
            <div className="flex gap-2">
              <Skeleton className="h-5 w-24 rounded-full" variant="block" />
              <Skeleton className="h-5 w-32 rounded-full" variant="block" />
            </div>
          </div>
        </div>
        <Skeleton className="h-7 w-20 rounded-md" variant="block" />
      </header>
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 space-y-4 lg:col-span-8">
          <div className="rounded-lg border border-border bg-canvas-card p-5">
            <Skeleton className="h-5 w-64" />
            <Skeleton className="mt-2 h-4 w-full" />
            <Skeleton className="mt-1.5 h-4 w-2/3" />
          </div>
          <div className="rounded-lg border border-border bg-canvas-card p-5">
            <Skeleton className="h-5 w-56" />
            <Skeleton className="mt-2 h-3 w-72" />
            <div className="mt-4 space-y-2">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-9 flex-1" variant="block" />
                </div>
              ))}
            </div>
          </div>
        </div>
        <aside className="col-span-12 space-y-3 lg:col-span-4">
          <div className="rounded-lg border border-border bg-canvas-card p-5 space-y-2">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-4 w-full" />
            <div className="space-y-2 pt-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-md" variant="block" />
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
