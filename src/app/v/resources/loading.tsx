import { Skeleton } from "@/components/ui/skeleton";

export default function VeteranResourcesLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-3 w-20" />
        <Skeleton className="mt-2 h-8 w-44" />
        <Skeleton className="mt-3 h-4 w-72 max-w-full" />
      </div>
      <ul className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <li key={i}>
            <div className="rounded-lg border border-border bg-canvas-card p-4">
              <div className="flex items-start gap-3">
                <Skeleton variant="block" className="h-9 w-9 rounded-md" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
