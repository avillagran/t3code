import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import {
  DEFAULT_CLIENT_SETTINGS,
  EnvironmentId,
  ThreadId,
  type ClientSettings,
  type DesktopPreviewBridge,
  type PreviewSessionSnapshot,
} from "@t3tools/contracts";
import { describe, expect, it, vi } from "vite-plus/test";

import { act, fakeTimers, render } from "../../test/render";

const mocks = vi.hoisted(() => ({
  getClientSettings: vi.fn<() => Promise<ClientSettings | null>>(),
  setClientSettings: vi.fn<(settings: ClientSettings) => Promise<void>>(),
  createTab: vi.fn<DesktopPreviewBridge["createTab"]>(),
  closeTab: vi.fn<DesktopPreviewBridge["closeTab"]>(),
  registerWebview: vi.fn<DesktopPreviewBridge["registerWebview"]>(),
  getPreviewConfig: vi.fn<DesktopPreviewBridge["getPreviewConfig"]>(),
}));

vi.mock(import("~/env"), async (original) => ({ ...(await original()), isElectron: true }));

vi.mock(import("~/state/session"), async (original) => ({
  ...(await original()),
  useEnvironmentScope: () => true,
}));

vi.mock(import("~/localApi"), async (original) => {
  const actual = await original();
  return {
    ...actual,
    ensureLocalApi: () => ({ ...actual.ensureLocalApi(), persistence: mocks as never }),
  };
});

// The Electron desktop bridge; a browser has none.
vi.mock(import("~/components/preview/previewBridge"), async (original) => ({
  ...(await original()),
  previewBridge: {
    createTab: mocks.createTab,
    closeTab: mocks.closeTab,
    registerWebview: mocks.registerWebview,
    getPreviewConfig: mocks.getPreviewConfig,
  } as never,
}));

vi.mock(import("~/components/preview/usePreviewBridge"), async (original) => ({
  ...(await original()),
  usePreviewBridge: () => undefined,
}));

// Natively rendered server tabs otherwise need a primary environment in the catalog.
vi.mock(import("./previewRuntime"), async (original) => ({
  ...(await original()),
  rendersServerTabNatively: (_environmentId, _primaryEnvironmentId, snapshot) =>
    snapshot?.runtime === "server",
}));

import {
  __resetClientSettingsPersistenceForTests,
  ensureClientSettingsHydrated,
} from "~/hooks/useSettings";
import {
  applyPreviewDesktopState,
  applyPreviewServerEvent,
  type DesktopPreviewOverlay,
  reconcilePreviewServerSessions,
  resetPreviewStateForTests,
} from "~/previewStateStore";
import { AppAtomRegistryProvider } from "~/rpc/atomRegistry";
import { acquireBrowserSurface } from "./browserSurfaceStore";
import { ElectronBrowserHost } from "./ElectronBrowserHost";
import { HIDDEN_GUEST_DISCARD_DELAY_MS } from "./HostedBrowserWebview";
import { previewRuntimeTabId } from "./previewRuntimeTabId";

const threadRef = scopeThreadRef(
  EnvironmentId.make("host-webview-order"),
  ThreadId.make("thread-webview-order"),
);

const snapshot = (tabId: string, updatedAt: string): PreviewSessionSnapshot => ({
  threadId: threadRef.threadId,
  tabId,
  navStatus: { _tag: "Success", url: `https://example.com/${tabId}`, title: tabId },
  canGoBack: false,
  canGoForward: false,
  updatedAt,
});

const idleOverlay: DesktopPreviewOverlay = {
  hasWebContents: true,
  navStatus: { _tag: "Idle" },
  canGoBack: false,
  canGoForward: false,
  loading: false,
  zoomFactor: 1,
  pictureInPicture: false,
  colorScheme: "system",
  audioMuted: false,
  audible: false,
  controller: "none",
  inUse: false,
  favicon: null,
};

const webviewFor = (container: HTMLElement, tabId: string) =>
  container.querySelector(`webview[data-preview-server-tab="${tabId}"]`);

/** Shows the tab in a panel, then hides it, so its idle wait starts under the test's clock. */
async function showThenHide(tabId: string) {
  const surface = acquireBrowserSurface(previewRuntimeTabId(threadRef, "server-a", tabId));
  await act(() => {
    surface.present({ x: 0, y: 0, width: 800, height: 600 }, true);
  });
  await act(() => surface.release());
}

function setup(): Disposable {
  __resetClientSettingsPersistenceForTests();
  mocks.getClientSettings.mockReset().mockResolvedValue(DEFAULT_CLIENT_SETTINGS);
  mocks.setClientSettings.mockReset().mockResolvedValue(undefined);
  mocks.createTab.mockReset().mockResolvedValue(undefined);
  mocks.closeTab.mockReset().mockResolvedValue(undefined);
  mocks.registerWebview.mockReset().mockResolvedValue(undefined);
  mocks.getPreviewConfig.mockReset().mockResolvedValue({
    partition: "persist:t3-preview-default",
    webPreferences: "contextIsolation=yes",
    preloadUrl: null,
  });
  return {
    [Symbol.dispose]() {
      resetPreviewStateForTests();
      __resetClientSettingsPersistenceForTests();
    },
  };
}

async function renderHost() {
  await using stack = new AsyncDisposableStack();
  const screen = stack.use(
    await render(
      <AppAtomRegistryProvider>
        <ElectronBrowserHost />
      </AppAtomRegistryProvider>,
    ),
  );
  // Unmounting releases each tab on a close timer; run it now so it never fires in a later test.
  stack.defer(async () => {
    using _timers = fakeTimers();
    await screen.unmount();
    await vi.advanceTimersByTimeAsync(0);
  });
  await act(() => ensureClientSettingsHydrated());
  const environment = stack.move();
  return { container: screen.container, [Symbol.asyncDispose]: () => environment.disposeAsync() };
}

describe("ElectronBrowserHost", () => {
  it("never moves a tab's webview when the server reorders tabs by last update", async () => {
    using _state = setup();
    reconcilePreviewServerSessions(threadRef, {
      sessions: [
        snapshot("tab_7", "2026-01-01T00:00:01.000Z"),
        snapshot("tab_8", "2026-01-01T00:00:02.000Z"),
      ],
      serverEpoch: "server-a",
      revision: 1,
    });
    await using screen = await renderHost();

    const host = screen.container.querySelector("[data-electron-browser-host]")!;
    const webviews = () => [...host.querySelectorAll("webview")];
    const before = webviews();
    expect(before.map((node) => node.getAttribute("data-preview-server-tab")).toSorted()).toEqual([
      "tab_7",
      "tab_8",
    ]);

    // Electron destroys a webview's guest when its element leaves the DOM, so a reorder that
    // detaches and re-inserts the element blanks the tab.
    const detached: Node[] = [];
    const observer = new MutationObserver((records) => {
      for (const record of records) detached.push(...record.removedNodes);
    });
    observer.observe(host, { childList: true, subtree: true });

    await act(async () => {
      reconcilePreviewServerSessions(threadRef, {
        sessions: [
          snapshot("tab_8", "2026-01-01T00:00:02.000Z"),
          snapshot("tab_7", "2026-01-01T00:00:03.000Z"),
        ],
        serverEpoch: "server-a",
        revision: 2,
      });
    });
    observer.takeRecords().forEach((record) => detached.push(...record.removedNodes));
    observer.disconnect();

    expect(detached).toEqual([]);
    const after = webviews();
    expect(after).toHaveLength(2);
    expect(after.every((node, index) => node.isSameNode(before[index]!))).toBe(true);
  });

  it("discards a hidden idle guest unless its page is busy, and reloads its current URL when shown", async () => {
    using _state = setup();
    reconcilePreviewServerSessions(threadRef, {
      sessions: [
        snapshot("tab_7", "2026-01-01T00:00:01.000Z"),
        snapshot("tab_8", "2026-01-01T00:00:01.000Z"),
      ],
      serverEpoch: "server-a",
      revision: 1,
    });
    await using screen = await renderHost();
    await vi.waitFor(() => expect(webviewFor(screen.container, "tab_7")).not.toBeNull());
    using _timers = fakeTimers({ shouldClearNativeTimers: true });

    await act(() => {
      applyPreviewDesktopState(threadRef, "tab_8", { ...idleOverlay, audible: true });
    });
    await showThenHide("tab_7");
    await showThenHide("tab_8");
    await act(() => vi.advanceTimersByTimeAsync(HIDDEN_GUEST_DISCARD_DELAY_MS - 1));
    expect(webviewFor(screen.container, "tab_7")).not.toBeNull();
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(webviewFor(screen.container, "tab_7")).toBeNull();
    expect(webviewFor(screen.container, "tab_8")).not.toBeNull();

    await act(() => {
      reconcilePreviewServerSessions(threadRef, {
        sessions: [
          {
            ...snapshot("tab_7", "2026-01-01T00:00:02.000Z"),
            navStatus: { _tag: "Success", url: "https://example.com/next", title: "next" },
          },
          snapshot("tab_8", "2026-01-01T00:00:01.000Z"),
        ],
        serverEpoch: "server-a",
        revision: 2,
      });
    });
    expect(webviewFor(screen.container, "tab_7")).toBeNull();
    const surface = acquireBrowserSurface(previewRuntimeTabId(threadRef, "server-a", "tab_7"));
    await act(() => {
      surface.present({ x: 0, y: 0, width: 800, height: 600 }, true);
    });
    expect(webviewFor(screen.container, "tab_7")?.getAttribute("src")).toBe(
      "https://example.com/next",
    );
    surface.release();
  });

  it("wakes a discarded server tab when the server republishes its session", async () => {
    using _state = setup();
    const serverSnapshot: PreviewSessionSnapshot = {
      ...snapshot("tab_7", "2026-01-01T00:00:01.000Z"),
      runtime: "server",
    };
    reconcilePreviewServerSessions(threadRef, {
      sessions: [serverSnapshot],
      serverEpoch: "server-a",
      revision: 1,
    });
    await using screen = await renderHost();
    await vi.waitFor(() => expect(webviewFor(screen.container, "tab_7")).not.toBeNull());
    using _timers = fakeTimers({ shouldClearNativeTimers: true });

    await showThenHide("tab_7");
    await act(() => vi.advanceTimersByTimeAsync(HIDDEN_GUEST_DISCARD_DELAY_MS));
    expect(webviewFor(screen.container, "tab_7")).toBeNull();

    // The server announces a detached tab an agent wants to drive with an unchanged snapshot.
    await act(() => {
      applyPreviewServerEvent(threadRef, {
        type: "resized",
        threadId: threadRef.threadId,
        tabId: "tab_7",
        createdAt: "2026-01-01T00:10:00.000Z",
        serverEpoch: "server-a",
        revision: 2,
        snapshot: { ...serverSnapshot },
      });
    });
    expect(webviewFor(screen.container, "tab_7")?.getAttribute("src")).toBe(
      "https://example.com/tab_7",
    );
  });
});
