import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIState {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  pinnedCollectionIds: string[];
  togglePinCollection: (id: string) => void;
  isPinned: (id: string) => boolean;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      isSidebarOpen: typeof window !== "undefined" ? window.innerWidth >= 768 : true,
      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      setSidebarOpen: (open: boolean) => set({ isSidebarOpen: open }),
      pinnedCollectionIds: [],
      togglePinCollection: (id: string) =>
        set((state) => ({
          pinnedCollectionIds: state.pinnedCollectionIds.includes(id)
            ? state.pinnedCollectionIds.filter((item) => item !== id)
            : [...state.pinnedCollectionIds, id],
        })),
      isPinned: (id: string) => get().pinnedCollectionIds.includes(id),
    }),
    {
      name: "docmind-ui-storage",
      partialize: (state) => ({ pinnedCollectionIds: state.pinnedCollectionIds }),
    }
  )
);
