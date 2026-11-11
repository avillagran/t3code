export const THREAD_SNAPSHOT_IDLE_TTL_MS = 5 * 60_000;

const MAX_IDLE_THREAD_RESUME_SNAPSHOTS = 6;

interface RetainedResume {
  snapshot: unknown;
}

/**
 * Tracks resume caches by recency and drops the snapshot of the least recently used idle ones
 * beyond `max`. Mounted threads are never trimmed.
 */
export function createResumeRetention(max = MAX_IDLE_THREAD_RESUME_SNAPSHOTS) {
  const entries = new Map<string, { cache: RetainedResume; mounted: number }>();

  const trim = () => {
    let idle = 0;
    for (const entry of entries.values()) if (entry.mounted === 0) idle++;
    for (const [key, entry] of entries) {
      if (idle <= max) break;
      if (entry.mounted > 0) continue;
      entry.cache.snapshot = undefined;
      entries.delete(key);
      idle--;
    }
  };

  return {
    /** Registers a cache; returns a function that forgets it when its atom is disposed. */
    track(key: string, cache: RetainedResume) {
      entries.set(key, { cache, mounted: 0 });
      return () => {
        if (entries.get(key)?.cache === cache) entries.delete(key);
      };
    },
    /** Marks the key most recently used and mounted; returns the unmount callback. */
    mount(key: string, cache: RetainedResume) {
      const entry = entries.get(key) ?? { cache, mounted: 0 };
      entries.delete(key);
      entries.set(key, entry);
      entry.mounted++;
      return () => {
        entry.mounted--;
        if (entries.get(key) === entry) trim();
      };
    },
  };
}
