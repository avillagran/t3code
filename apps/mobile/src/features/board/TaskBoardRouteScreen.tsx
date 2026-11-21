import { useAtomValue } from "@effect/atom-react";
import { LegendList } from "@legendapp/list/react-native";
import { StackActions, useNavigation } from "@react-navigation/native";
import { msg, useGT, useMessages } from "gt-react-native";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { AppBar } from "../../components/ui/AppBar";
import { ScreenContent } from "../../components/ui/ScreenContent";
import { NativeScrollView } from "../../native/NativeScrollViewMarker";
import { startOpeningDetail } from "../layout/workspace/useSelectWorkspaceDetail";
import { cn } from "../../lib/cn";
import { scopedProjectKey, scopedThreadKey } from "../../lib/scopedEntities";
import { useProjects } from "../../state/entities";
import { useSavedRemoteConnections } from "../../state/use-remote-environment-registry";
import { steadyNavigationThreadShellsAtom } from "../../state/threads";
import { useThreadListNow } from "../threads/use-thread-list-now";
import { groupTaskBoardThreads, type TaskBoardPanel } from "./taskBoard";

const panels = [
  { id: "attention", label: msg("Needs you") },
  { id: "working", label: msg("Working") },
  { id: "failed", label: msg("Failed") },
  { id: "waiting", label: msg("Waiting") },
  { id: "done", label: msg("Done") },
  { id: "snoozed", label: msg("Snoozed") },
  { id: "settled", label: msg("Settled") },
] as const;

export function TaskBoardRouteScreen() {
  const gt = useGT();
  const m = useMessages();
  const navigation = useNavigation();
  const [selected, setSelected] = useState<TaskBoardPanel>("attention");
  const threads = useAtomValue(steadyNavigationThreadShellsAtom);
  const projects = useProjects();
  const { savedConnectionsById } = useSavedRemoteConnections();
  const now = useThreadListNow(threads);
  const grouped = useMemo(() => groupTaskBoardThreads(threads, now), [threads, now]);
  const projectTitles = useMemo(
    () =>
      new Map(
        projects.map((project) => [
          scopedProjectKey(project.environmentId, project.id),
          project.title,
        ]),
      ),
    [projects],
  );
  const selectedThreads = grouped[selected];

  return (
    <View className="flex-1 bg-screen">
      <AppBar title={gt("Task Board")} onBack={() => navigation.goBack()} />
      <ScreenContent surface="screen">
        <View className="flex-1">
          <View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="gap-2 px-4 py-3"
            >
              {panels.map((panel) => (
                <Pressable
                  key={panel.id}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: selected === panel.id }}
                  className={cn(
                    "min-h-11 justify-center rounded-full border border-border px-4",
                    selected === panel.id && "border-primary bg-primary/10",
                  )}
                  onPress={() => setSelected(panel.id)}
                >
                  <Text className="font-medium text-foreground">
                    {gt("{label} ({count})", {
                      label: m(panel.label),
                      count: grouped[panel.id].length,
                    })}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
          <LegendList
            key={selected}
            data={selectedThreads}
            estimatedItemSize={62}
            keyExtractor={(thread) => scopedThreadKey(thread.environmentId, thread.id)}
            renderScrollComponent={NativeScrollView}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
            ListEmptyComponent={
              <Text className="py-8 text-center text-sm text-foreground-muted">
                {gt("No threads in this group")}
              </Text>
            }
            renderItem={({ item: thread }) => {
              const project = projectTitles.get(
                scopedProjectKey(thread.environmentId, thread.projectId),
              );
              const environment = savedConnectionsById[thread.environmentId]?.environmentLabel;
              const subtitle = [project, environment].filter(Boolean).join(" · ");
              return (
                <Pressable
                  accessibilityRole="button"
                  className="mb-2 min-h-12 justify-center rounded-xl border border-border bg-card px-4 py-2"
                  onPress={() => {
                    const params = { environmentId: thread.environmentId, threadId: thread.id };
                    startOpeningDetail({ name: "Thread", params });
                    navigation.dispatch(StackActions.push("Thread", params));
                  }}
                >
                  <Text className="font-medium text-foreground" numberOfLines={2}>
                    {thread.title}
                  </Text>
                  {subtitle ? (
                    <Text className="text-sm text-foreground-muted" numberOfLines={1}>
                      {subtitle}
                    </Text>
                  ) : null}
                </Pressable>
              );
            }}
          />
        </View>
      </ScreenContent>
    </View>
  );
}
