import { ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { makeThreadShellFixture } from "../../test-fixtures";
import { groupTaskBoardThreads } from "./taskBoard";

const now = "2026-07-02T00:00:00.000Z";

describe("groupTaskBoardThreads", () => {
  it("keeps pinned work first, prioritizes requests and regroups threads when a snooze ends", () => {
    const runtime = {
      status: "running",
      activeRunId: null,
      providerInstanceId: makeThreadShellFixture().providerInstanceId,
      providerName: null,
      lastError: null,
      updatedAt: now,
    } as const;
    const running = makeThreadShellFixture({
      id: ThreadId.make("running"),
      runtime,
      updatedAt: now,
    });
    const pinned = makeThreadShellFixture({
      id: ThreadId.make("pinned"),
      runtime,
      pinnedAt: "2026-07-01T00:00:00.000Z",
    });
    const approval = makeThreadShellFixture({
      id: ThreadId.make("approval"),
      runtime,
      hasPendingApprovals: true,
    });
    const snoozed = makeThreadShellFixture({
      id: ThreadId.make("snoozed"),
      snoozedAt: now,
      snoozedUntil: "2026-07-03T00:00:00.000Z",
    });
    const archived = makeThreadShellFixture({
      id: ThreadId.make("archived"),
      archivedAt: now,
    });
    const threads = [running, approval, snoozed, pinned, archived];
    const before = groupTaskBoardThreads(threads, now);
    expect(before.attention).toEqual([approval]);
    expect(before.working).toEqual([pinned, running]);
    expect(before.snoozed).toEqual([snoozed]);
    expect(before.done).toEqual([]);
    const after = groupTaskBoardThreads(threads, snoozed.snoozedUntil!);
    expect(after.snoozed).toEqual([]);
    expect(after.done).toEqual([snoozed]);
  });
});
