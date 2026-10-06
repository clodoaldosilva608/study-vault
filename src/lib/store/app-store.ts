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
  bootstrap: () => Promise<void>;
  setView: (v: ViewKey) => void;
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
  sidebarOpen: true,

  bootstrap: async () => {
    set({ loading: true });
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
      });
    } catch {
      set({ user: null, workspace: null, role: null, loading: false });
    }
  },

  setView: (v) => set({ view: v, selectedFileIds: new Set<string>() }),

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
    });
  },
}));
