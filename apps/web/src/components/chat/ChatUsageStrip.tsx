import { useAtomValue } from "@effect/atom-react";
import { useNavigate } from "@tanstack/react-router";
import { memo } from "react";

import { useNowMinute } from "../../hooks/useNowMinute";
import { useClientSettings } from "../../hooks/useSettings";
import { environmentPresentations } from "../../state/presentation";
import { providerClients } from "../settings/providerDriverMeta";
import { barColor } from "../usage/UsageLimits";
import { collectUsageStripItems } from "./chatUsageStrip.logic";

/** Always-visible provider usage bars. Takes no props, so chat stream renders skip it. */
export const ChatUsageStrip = memo(function ChatUsageStrip() {
  const enabled = useClientSettings((s) => s.chatUsageStripEnabled);
  const presentations = useAtomValue(environmentPresentations.presentationsWithProvidersAtom);
  const nowMinute = useNowMinute();
  const navigate = useNavigate();
  const items = enabled
    ? collectUsageStripItems(presentations, Date.parse(`${nowMinute}:00Z`))
    : [];
  if (items.length === 0) return null;
  return (
    <button
      type="button"
      aria-label="Open provider usage"
      onClick={() => void navigate({ to: "/usage" })}
      className="flex w-full shrink-0 cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 overflow-hidden bg-background px-(--workspace-gutter-start,1rem) py-1 text-start text-2xs text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    >
      {items.map((item) => {
        const provider = providerClients.get(item.driver)?.label ?? String(item.driver);
        const used = Math.round(item.usedPercent);
        return (
          <span
            key={item.key}
            className="flex min-w-0 items-center gap-1.5 whitespace-nowrap tabular-nums"
          >
            <span className="truncate">
              {provider} {item.windowLabel}
            </span>
            <span className="relative flex h-2.5 w-14 shrink-0 items-center">
              <span className="relative h-1 w-full overflow-hidden rounded-full bg-muted">
                <span
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${Math.min(100, Math.max(0, used))}%`,
                    backgroundColor: item.overPace
                      ? "var(--color-destructive)"
                      : barColor(item.driver),
                  }}
                />
              </span>
              {item.expectedUsedPercent === null ? null : (
                <span
                  aria-hidden
                  className="absolute inset-y-0 w-0.5 -translate-x-1/2 rounded-full bg-foreground"
                  style={{ left: `${Math.min(100, Math.max(0, item.expectedUsedPercent))}%` }}
                />
              )}
            </span>
            <span className="text-foreground">{used}%</span>
            {item.resetsIn ? <span>{item.resetsIn}</span> : null}
          </span>
        );
      })}
    </button>
  );
});
