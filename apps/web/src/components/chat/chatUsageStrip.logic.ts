import {
  collectLimitAccounts,
  collectLimitPools,
  displayLimitWindows,
  elapsedShare,
  formatDuration,
  type LimitPool,
  type LimitPresentations,
} from "@t3tools/shared/usageLimits";

export interface UsageStripItem {
  readonly key: string;
  readonly driver: LimitPool["driver"];
  readonly windowLabel: string;
  readonly usedPercent: number;
  readonly resetsIn: string | null;
  /** Spending faster than the window elapses. */
  readonly overPace: boolean;
  /** Percent of the window already elapsed, where the bar would sit on even pace. Null when unknown. */
  readonly expectedUsedPercent: number | null;
}

export function usageStripItems(
  pools: readonly LimitPool[],
  now: number,
): readonly UsageStripItem[] {
  return pools.flatMap((pool) =>
    displayLimitWindows(pool).map((window) => {
      const shares = window.members.flatMap((member) => {
        const share = elapsedShare(member.window, now);
        return share === null ? [] : [share];
      });
      const next = window.resets.find((reset) => reset.at > now);
      return {
        key: `${pool.driver}:${window.id}`,
        driver: pool.driver,
        windowLabel: window.label,
        usedPercent: window.usedPercent,
        resetsIn: next ? formatDuration(next.at - now) : null,
        overPace: window.pace === "ahead",
        expectedUsedPercent:
          shares.length === 0
            ? null
            : (shares.reduce((sum, share) => sum + share, 0) / shares.length) * 100,
      };
    }),
  );
}

export function collectUsageStripItems(
  presentations: LimitPresentations,
  now: number,
): readonly UsageStripItem[] {
  return usageStripItems(collectLimitPools(collectLimitAccounts(presentations), now), now);
}
