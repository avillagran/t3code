import { describe, expect, it } from "vite-plus/test";
import type { LimitPool } from "@t3tools/shared/usageLimits";

import { usageStripItems } from "./chatUsageStrip.logic";

const NOW = Date.parse("2026-01-01T00:00:00Z");

describe("usageStripItems", () => {
  it("uses the next future reset and flags windows ahead of pace", () => {
    const pool = {
      driver: "claudeAgent",
      accounts: [],
      windows: [
        {
          id: "five_hour",
          kind: "session",
          label: "5h",
          members: [],
          columns: [],
          remainingPercent: 40,
          usedPercent: 60,
          pace: "ahead",
          resets: [
            { at: NOW - 1000, restoresPercent: 0 },
            { at: NOW + 90 * 60_000, restoresPercent: 0 },
          ],
        },
        {
          id: "seven_day",
          kind: "weekly",
          label: "Weekly",
          members: [],
          columns: [],
          remainingPercent: 90,
          usedPercent: 10,
          pace: null,
          resets: [],
        },
      ],
    } as unknown as LimitPool;
    expect(usageStripItems([pool], NOW)).toMatchObject([
      { key: "claudeAgent:five_hour", usedPercent: 60, resetsIn: "1h 30m", overPace: true },
      { key: "claudeAgent:seven_day", usedPercent: 10, resetsIn: null, overPace: false },
    ]);
  });
});
