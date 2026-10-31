import { describe, it, expect, beforeEach } from "vitest";
import { useUIStore } from "./ui-store";

describe("UI Store", () => {
  beforeEach(() => {
    // Reset state before each test
    useUIStore.setState({
      isSidebarOpen: true,
      pinnedCollectionIds: [],
    });
  });

  it("toggles sidebar visibility", () => {
    expect(useUIStore.getState().isSidebarOpen).toBe(true);

    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().isSidebarOpen).toBe(false);

    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().isSidebarOpen).toBe(true);
  });

  it("sets sidebar visibility directly", () => {
    useUIStore.getState().setSidebarOpen(false);
    expect(useUIStore.getState().isSidebarOpen).toBe(false);

    useUIStore.getState().setSidebarOpen(true);
    expect(useUIStore.getState().isSidebarOpen).toBe(true);
  });

  it("pins and unpins collections correctly", () => {
    const colId = "col-xyz-123";

    expect(useUIStore.getState().isPinned(colId)).toBe(false);

    // Pin
    useUIStore.getState().togglePinCollection(colId);
    expect(useUIStore.getState().pinnedCollectionIds).toContain(colId);
    expect(useUIStore.getState().isPinned(colId)).toBe(true);

    // Unpin
    useUIStore.getState().togglePinCollection(colId);
    expect(useUIStore.getState().pinnedCollectionIds).not.toContain(colId);
    expect(useUIStore.getState().isPinned(colId)).toBe(false);
  });
});
