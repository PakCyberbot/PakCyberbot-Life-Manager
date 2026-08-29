import { create } from 'zustand';

// A tiny cross-screen signal: "when Library next mounts/updates, switch to
// this tab and highlight this item." Used by a Task's linked book/video —
// clicking it navigates to Library and jumps straight to that item, rather
// than leaving the user to find it themselves. LibraryScreen consumes and
// clears this once it acts on it, so it only fires once per navigation.

export interface LibraryFocusTarget {
  type: 'book' | 'video';
  id: string;
}

interface UiFocusState {
  libraryFocus: LibraryFocusTarget | null;
  setLibraryFocus: (target: LibraryFocusTarget) => void;
  clearLibraryFocus: () => void;
}

export const useUiFocusStore = create<UiFocusState>((set) => ({
  libraryFocus: null,
  setLibraryFocus: (target) => set({ libraryFocus: target }),
  clearLibraryFocus: () => set({ libraryFocus: null }),
}));
