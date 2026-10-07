'use client';

import { create } from 'zustand';
import { api } from '@/lib/api/client';

export type ViewKey =
  | 'dashboard'
  | 'files'
  | 'favorites'
  | 'recent'
  | 'trash'
  | 'search'
  | 'notes'
  | 'obsidian'
  | 'audit'
  | 'jarvis'
  | 'settings';

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
};

export type Workspace = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  storageLimitBytes: number;
};

type StoreState = {
  user: AuthUser | null;
  workspace: Workspace | null;
  role: string | null;
  loading: boolean;
  view: ViewKey;
  currentFolderId: string | null;
  selectedFileIds: Set<string>;
  sidebarOpen: boolean;
  viewHistory: ViewKey[];
  _bootstrapping: boolean;
  bootstrap: () => Promise<void>;
  setView: (v: ViewKey) => void;
  goBack: () => void;
  canGoBack: () => boolean;
  setCurrentFolder: (id: string | null) => void;
  toggleFileSelected: (id: string) => void;
  selectMany: (ids: string[]) => void;
  clearSelection: () => void;
  setSidebarOpen: (open: boolean) => void;
  logout: () => Promise<void>;
};

export const useAppStore = create<StoreState>((set, get) => ({
  user: null,
  workspace: null,
  role: null,
  loading: true,
  view: 'dashboard',
  currentFolderId: null,
  selectedFileIds: new Set<string>(),
  sidebarOpen: false, // mobile drawer closed by default
  viewHistory: [],
  _bootstrapping: false,

  bootstrap: async () => {
    // Guard: prevent multiple concurrent bootstrap calls
    if (get()._bootstrapping) return;
    set({ _bootstrapping: true, loading: true });
    try {
      const data = await api.get<{
        user: AuthUser | null;
        workspace: Workspace | null;
        role: string | null;
      }>('/api/v1/auth/me');
      set({
        user: data.user,
        workspace: data.workspace,
        role: data.role,
        loading: false,
        _bootstrapping: false,
      });
    } catch {
      set({
        user: null,
        workspace: null,
        role: null,
        loading: false,
        _bootstrapping: false,
      });
    }
  },

  setView: (v) => {
    const cur = get().view;
    set({
      view: v,
      selectedFileIds: new Set<string>(),
      viewHistory: cur ? [...get().viewHistory, cur] : get().viewHistory,
      sidebarOpen: false, // close mobile drawer on navigation
    });
  },

  goBack: () => {
    const history = get().viewHistory;
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    set({
      view: prev,
      viewHistory: history.slice(0, -1),
      selectedFileIds: new Set<string>(),
      sidebarOpen: false,
    });
  },

  canGoBack: () => get().viewHistory.length > 0,

  setCurrentFolder: (id) =>
    set({ currentFolderId: id, selectedFileIds: new Set<string>() }),

  toggleFileSelected: (id) => {
    const s = new Set(get().selectedFileIds);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    set({ selectedFileIds: s });
  },

  selectMany: (ids) => set({ selectedFileIds: new Set(ids) }),

  clearSelection: () => set({ selectedFileIds: new Set<string>() }),

  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  logout: async () => {
    try {
      await api.post('/api/v1/auth/logout');
    } catch {
      /* ignore */
    }
    set({
      user: null,
      workspace: null,
      role: null,
      view: 'dashboard',
      currentFolderId: null,
      selectedFileIds: new Set<string>(),
      viewHistory: [],
      sidebarOpen: false,
    });
  },
}));
