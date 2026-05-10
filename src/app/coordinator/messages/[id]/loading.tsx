import { Skeleton } from "@/components/ui/skeleton";

export default function CoordinatorThreadLoading() {
  return (
    <div className="flex h-[calc(100dvh-3rem)] flex-col">
      <header className="flex items-center gap-3 border-b border-border bg-canvas-card px-4 py-3">
        <Skeleton variant="block" className="h-8 w-8 rounded-md" />
        <Skeleton variant="circle" className="h-10 w-10" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-3 w-72" />
        </div>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className={i % 2 === 0 ? "flex justify-start" : "flex justify-end"}
          >
            <Skeleton
              variant="block"
              className={`h-16 ${i % 2 === 0 ? "w-2/3" : "w-1/2"} rounded-2xl`}
            />
          </div>
        ))}
      </div>
      <div className="border-t border-border bg-canvas-card p-3">
        <Skeleton variant="block" className="h-12 w-full rounded-md" />
      </div>
    </div>
  );
}
