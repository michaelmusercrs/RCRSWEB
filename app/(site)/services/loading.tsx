export default function ServicesLoading() {
  return (
    <div className="min-h-screen p-6 space-y-6">
      <div className="h-10 w-64 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
      <div className="h-4 w-96 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-48 bg-neutral-200 dark:bg-neutral-800 rounded-lg animate-pulse" />
        ))}
      </div>
    </div>
  );
}
