import { Skeleton } from "@/components/ui/skeleton";

export default function VeteranHomeLoading() {
  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-40" />
        </div>
        <Skeleton variant="circle" className="h-10 w-10" />
      </header>
      <div className="flex items-center gap-1">
        {Array.from({ length: 12 }).map((_, i) => (
          <span key={i} className="h-1 flex-1 rounded-full bg-border" />
        ))}
      </div>
      <Skeleton className="h-44 w-full rounded-xl" variant="block" />
      <Skeleton className="h-32 w-full rounded-xl" variant="block" />
    </div>
  );
}
