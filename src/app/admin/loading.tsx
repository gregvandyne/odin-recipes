import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLoading() {
  return (
    <div className="space-y-6 px-6 py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Skeleton className="h-3 w-32" />
          <Skeleton className="mt-2 h-8 w-64" />
          <Skeleton className="mt-3 h-4 w-72" />
        </div>
        <Skeleton className="h-7 w-20 rounded-md" variant="block" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-canvas-card p-5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-8 w-20" />
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-border bg-canvas-card p-5">
        <Skeleton className="h-5 w-56" />
        <Skeleton className="mt-2 h-4 w-72" />
        <div className="mt-5 grid grid-cols-2 gap-6 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-9 w-12" />
              <Skeleton className="mt-2 h-3 w-16" />
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-border bg-canvas-card p-5">
        <Skeleton className="h-5 w-72" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" variant="block" />
          ))}
        </div>
      </div>
    </div>
  );
}
