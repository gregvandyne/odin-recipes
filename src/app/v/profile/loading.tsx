import { Skeleton } from "@/components/ui/skeleton";

export default function VeteranProfileLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-3 w-16" />
        <Skeleton className="mt-2 h-8 w-40" />
      </div>
      <section className="rounded-lg border border-border bg-canvas-card p-5">
        <div className="flex items-start gap-3">
          <Skeleton variant="circle" className="h-12 w-12" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      </section>
      <section className="rounded-lg border border-border bg-canvas-card p-5">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="mt-2 h-3 w-72 max-w-full" />
      </section>
      <div className="overflow-hidden divide-y divide-border rounded-lg border border-border bg-canvas-card">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <Skeleton variant="block" className="h-9 w-9 rounded-md" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-44" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
