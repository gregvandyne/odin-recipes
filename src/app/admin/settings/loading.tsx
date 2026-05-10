import { Skeleton } from "@/components/ui/skeleton";

export default function AdminSettingsLoading() {
  return (
    <div className="space-y-6 px-6 py-6">
      <div>
        <Skeleton className="h-3 w-16" />
        <Skeleton className="mt-2 h-8 w-32" />
      </div>
      <section className="rounded-lg border border-border bg-canvas-card p-5">
        <div className="flex items-center gap-3">
          <Skeleton variant="block" className="h-10 w-10 rounded-md" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton variant="block" className="h-6 w-20 rounded-md" />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-4 w-28" />
          </div>
        </div>
      </section>
      <div className="overflow-hidden divide-y divide-border rounded-lg border border-border bg-canvas-card">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <Skeleton variant="block" className="h-9 w-9 rounded-md" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-56" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
