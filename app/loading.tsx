export default function RootLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="space-y-4 w-full max-w-md px-6">
        <div className="h-8 w-48 mx-auto bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
        <div className="h-4 w-64 mx-auto bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
      </div>
    </div>
  );
}
