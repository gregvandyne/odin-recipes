import { Skeleton } from "@/components/ui/skeleton";

/**
 * Triage queue loading state. Mirrors the live page's structural rhythm so
 * the layout doesn't shift when content arrives — the eye stays on the
 * same row positions.
 */
export default function CoordinatorLoading() {
  return (
    <div className="px-6 py-6">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <Skeleton className="h-3 w-16" />
          <Skeleton className="mt-2 h-8 w-48" />
        </div>
        <div className="flex gap-1.5">
          <Skeleton className="h-8 w-20 rounded-md" variant="block" />
          <Skeleton className="h-8 w-20 rounded-md" variant="block" />
          <Skeleton className="h-8 w-20 rounded-md" variant="block" />
        </div>
      </div>
      <Skeleton className="mb-3 h-4 w-72" />
      <div className="overflow-hidden rounded-lg border border-border bg-canvas-card">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-0"
          >
            <span aria-hidden className="absolute left-0 h-12 w-1 bg-canvas-banded" />
            <div className="ml-2 w-44 shrink-0 space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-16" />
            </div>
            <div className="hidden w-24 shrink-0 sm:block">
              <Skeleton className="h-5 w-16 rounded-full" variant="block" />
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
            <div className="hidden w-32 shrink-0 space-y-1.5 sm:block">
              <Skeleton className="ml-auto h-3 w-16" />
              <Skeleton className="ml-auto h-3 w-12" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
