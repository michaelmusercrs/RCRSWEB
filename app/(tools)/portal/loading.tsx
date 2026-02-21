export default function PortalLoading() {
  return (
    <div className="min-h-screen p-6 space-y-6">
      <div className="h-8 w-48 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-32 bg-neutral-200 dark:bg-neutral-800 rounded-lg animate-pulse" />
        ))}
      </div>
      <div className="h-64 bg-neutral-200 dark:bg-neutral-800 rounded-lg animate-pulse" />
    </div>
  );
}
