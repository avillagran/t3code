import { Fragment, type ReactNode } from "react";
import {
  ScrollView,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { cn } from "../../lib/cn";
import type { ThreadListV2DockedShelf, ThreadListV2ListItem } from "./threadListV2";

/** Expanded shelves share this fraction of the list region, so the active list keeps room. */
const DOCKED_SHELVES_MAX_HEIGHT_FRACTION = 0.45;

/**
 * Shelf headers docked below the active list, so they stay visible however far it scrolls.
 * An expanded shelf scrolls its own rows inside a bounded area.
 */
export function ThreadListV2DockedShelves(props: {
  readonly shelves: ReadonlyArray<ThreadListV2DockedShelf>;
  readonly renderItem: (item: ThreadListV2ListItem) => ReactNode;
  /** Rendered after the Settled rows, such as its Show more row. */
  readonly settledFooter?: ReactNode;
  readonly regionHeight: number;
  readonly pane: "screen" | "sidebar";
  readonly style?: StyleProp<ViewStyle>;
  readonly onLayout?: (event: LayoutChangeEvent) => void;
}) {
  if (props.shelves.length === 0) return null;
  const expandedCount = props.shelves.filter(
    (shelf) => shelf.header.expanded && shelf.rows.length > 0,
  ).length;
  const rowsMaxHeight =
    (props.regionHeight * DOCKED_SHELVES_MAX_HEIGHT_FRACTION) / Math.max(1, expandedCount);
  return (
    <View
      className={cn(
        "shrink-0 border-t",
        props.pane === "sidebar" ? "border-drawer-border" : "border-border-subtle",
      )}
      style={props.style}
      onLayout={props.onLayout}
    >
      {props.shelves.map((shelf) => {
        const footer = shelf.header.type === "v2-settled-shelf" ? props.settledFooter : null;
        return (
          <Fragment key={shelf.header.key}>
            {props.renderItem(shelf.header)}
            {shelf.header.expanded && (shelf.rows.length > 0 || footer) ? (
              <ScrollView
                style={{ maxHeight: rowsMaxHeight, flexGrow: 0 }}
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {shelf.rows.map((row) => (
                  <Fragment key={row.key}>{props.renderItem(row)}</Fragment>
                ))}
                {footer}
              </ScrollView>
            ) : null}
          </Fragment>
        );
      })}
    </View>
  );
}
