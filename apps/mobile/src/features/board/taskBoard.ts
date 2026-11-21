import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import {
  effectiveSnoozed,
  hasUnseenRunFailure,
} from "@t3tools/client-runtime/state/thread-settled";
import { isListedThreadLineage } from "@t3tools/contracts";

import { resolveThreadListV2RowStatus } from "../threads/threadListV2";

export type TaskBoardPanel =
  | "attention"
  | "working"
  | "failed"
  | "waiting"
  | "done"
  | "snoozed"
  | "settled";

function panelForThread(thread: EnvironmentThreadShell, now: string): TaskBoardPanel {
  if (thread.settledOverride === "settled") return "settled";
  if (effectiveSnoozed(thread, { now })) return "snoozed";
  switch (resolveThreadListV2RowStatus(thread)) {
    case "approval":
    case "input":
    case "request":
      return "attention";
    case "working":
      return "working";
    case "waiting":
      return "waiting";
    case "failed":
    case "limited":
      return "failed";
    case "ready":
      return hasUnseenRunFailure(thread) ? "failed" : "done";
  }
}

export function groupTaskBoardThreads(threads: readonly EnvironmentThreadShell[], now: string) {
  const panels: Record<TaskBoardPanel, EnvironmentThreadShell[]> = {
    attention: [],
    working: [],
    failed: [],
    waiting: [],
    done: [],
    snoozed: [],
    settled: [],
  };
  for (const thread of threads) {
    if (thread.archivedAt !== null || !isListedThreadLineage(thread.lineage)) continue;
    panels[panelForThread(thread, now)].push(thread);
  }
  for (const threads of Object.values(panels)) {
    threads.sort(
      (a, b) =>
        Number(b.pinnedAt != null) - Number(a.pinnedAt != null) ||
        (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0),
    );
  }
  return panels;
}
