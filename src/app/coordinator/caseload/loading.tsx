import { Skeleton } from "@/components/ui/skeleton";

export default function CoordinatorCaseloadLoading() {
  return (
    <div className="space-y-6 px-6 py-6">
      <div>
        <Skeleton className="h-3 w-16" />
        <Skeleton className="mt-2 h-8 w-44" />
        <Skeleton className="mt-3 h-4 w-20" />
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-canvas-card divide-y divide-border">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <Skeleton variant="circle" className="h-10 w-10" />
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-44" />
                <Skeleton variant="block" className="h-5 w-12 rounded-full" />
              </div>
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
