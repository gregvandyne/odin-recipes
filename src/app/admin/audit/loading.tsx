import { Skeleton } from "@/components/ui/skeleton";

export default function AdminAuditLoading() {
  return (
    <div className="space-y-6 px-6 py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-2 h-8 w-32" />
          <Skeleton className="mt-3 h-4 w-72 max-w-full" />
        </div>
        <Skeleton variant="block" className="h-10 w-40 rounded-md" />
      </div>
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-canvas-card p-4">
        <Skeleton variant="block" className="h-10 w-44 rounded-md" />
        <Skeleton variant="block" className="h-10 w-36 rounded-md" />
        <Skeleton variant="block" className="h-10 w-36 rounded-md" />
      </div>
      <div className="rounded-lg border border-border bg-canvas-card overflow-hidden">
        <Skeleton variant="block" className="h-9 w-full rounded-none" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="grid grid-cols-5 gap-3 border-b border-border/60 px-3 py-2.5 last:border-0">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
