/**
 * Per-key in-memory async mutex — serializes handlers that must not interleave
 * within a single server instance (e.g. two rapid verify-load / undo clicks on
 * the SAME ticket racing the inventory-deduction read/modify/write window).
 *
 * Scope caveat: this is per-instance. Under Fluid Compute two truly-simultaneous
 * requests could land on different instances and skip the lock; for the warehouse
 * workflow (one or two users, same ticket) that's negligible, and the deduction
 * log + status guards catch the rare cross-instance case. This closes the common
 * double-click race cheaply without a distributed lock.
 */

const chains = new Map<string, Promise<unknown>>();

export function withKeyLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = chains.get(key) ?? Promise.resolve();
  // Run fn after prev settles, regardless of prev's outcome.
  const run = prev.then(() => fn(), () => fn());
  const guarded = run.catch(() => {});
  chains.set(key, guarded);
  // Drop the entry once this is the tail, so the map doesn't grow unbounded.
  guarded.then(() => { if (chains.get(key) === guarded) chains.delete(key); });
  return run;
}
