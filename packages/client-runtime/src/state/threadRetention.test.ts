import { describe, expect, it } from "@effect/vitest";

import { createResumeRetention } from "./threadRetention.ts";

describe("createResumeRetention", () => {
  it("drops the oldest idle snapshots beyond the cap and keeps mounted ones", () => {
    const retention = createResumeRetention(2);
    const caches = ["a", "b", "c", "d"].map((key) => ({
      key,
      cache: { snapshot: key as unknown },
    }));
    const unmount = new Map<string, () => void>();
    for (const { key, cache } of caches) {
      retention.track(key, cache);
      unmount.set(key, retention.mount(key, cache));
    }
    for (const key of ["b", "c", "d"]) unmount.get(key)?.();
    // "a" stays mounted; b, c, d are idle and only the two most recent survive.
    expect(caches.map((c) => c.cache.snapshot)).toEqual(["a", undefined, "c", "d"]);

    unmount.get("a")?.();
    expect(caches.map((c) => c.cache.snapshot)).toEqual([undefined, undefined, "c", "d"]);
  });

  it("tracks a cache again after it was trimmed", () => {
    const retention = createResumeRetention(0);
    const cache = { snapshot: "x" as unknown };
    retention.track("a", cache);
    retention.mount("a", cache)();
    expect(cache.snapshot).toBeUndefined();
    cache.snapshot = "y";
    retention.mount("a", cache)();
    expect(cache.snapshot).toBeUndefined();
  });
});
