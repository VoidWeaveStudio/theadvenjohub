//src\core\ui\Skeleton.tsx
export function CardSkeleton() {
  return (
    <div className="group relative bg-gradient-to-br from-surface to-surface/80 border border-border rounded-xl overflow-hidden">
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-surface rounded-xl animate-pulse" />
            <div className="h-5 w-16 bg-surface rounded-full animate-pulse" />
          </div>
          <div className="h-5 w-5 bg-surface rounded animate-pulse" />
        </div>
        <div className="h-6 w-3/4 bg-surface rounded animate-pulse mb-2" />
        <div className="h-4 w-full bg-surface rounded animate-pulse mb-1" />
        <div className="h-4 w-2/3 bg-surface rounded animate-pulse mb-4" />
        <div className="flex items-center gap-2 mb-4 pb-4 border-b border-border">
          <div className="h-4 w-4 bg-surface rounded animate-pulse" />
          <div className="h-4 w-1/2 bg-surface rounded animate-pulse" />
        </div>
        <div className="flex gap-2 mb-4">
          <div className="h-8 w-20 bg-surface rounded-lg animate-pulse" />
          <div className="h-8 w-20 bg-surface rounded-lg animate-pulse" />
        </div>
        <div className="h-10 w-full bg-surface rounded-lg animate-pulse" />
      </div>
    </div>
  );
}