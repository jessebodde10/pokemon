import { Skeleton } from '@/components/ui/primitives';

export default function ReviewLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <Skeleton className="h-9 w-72" />
      <Skeleton className="mt-4 h-5 w-full max-w-xl" />
      <div className="mt-8 space-y-4">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="h-56 w-full" />
        ))}
      </div>
      <span className="sr-only">Kaarten worden geladen</span>
    </div>
  );
}
