import { create } from 'zustand';
import type {
  Restaurant, Recipe,
  EatOutFilters, EatInFilters,
  WheelItem, CuisineOption, VibeOption, EffortLevel,
} from '@/types';

// ─── Eat Out ──────────────────────────────────────────────────────────────────

interface EatOutState {
  filters: EatOutFilters;
  wheelItems: WheelItem<Restaurant>[];
  isLoading: boolean;
  error: string | null;
  winner: Restaurant | null;
  setFilters: (f: Partial<EatOutFilters>) => void;
  setWheelItems: (items: WheelItem<Restaurant>[]) => void;
  addWheelItem: (item: WheelItem<Restaurant>) => void;
  removeWheelItem: (id: string) => void;
  setLoading: (v: boolean) => void;
  setError: (e: string | null) => void;
  setWinner: (r: Restaurant | null) => void;
  reset: () => void;
}

const defaultEatOutFilters: EatOutFilters = { cuisines: [], vibes: [], radiusMiles: 2.5 };

export const useEatOutStore = create<EatOutState>()((set) => ({
  filters: defaultEatOutFilters,
  wheelItems: [],
  isLoading: false,
  error: null,
  winner: null,
  setFilters: (f) => set((s) => ({ filters: { ...s.filters, ...f } })),
  setWheelItems: (items) => set({ wheelItems: items }),
  addWheelItem: (item) => set((s) => ({ wheelItems: [...s.wheelItems, item] })),
  removeWheelItem: (id) => set((s) => ({ wheelItems: s.wheelItems.filter((i) => i.id !== id) })),
  setLoading: (v) => set({ isLoading: v }),
  setError: (e) => set({ error: e }),
  setWinner: (r) => set({ winner: r }),
  reset: () => set({ filters: defaultEatOutFilters, wheelItems: [], winner: null, error: null }),
}));

// ─── Eat In ───────────────────────────────────────────────────────────────────

interface EatInState {
  filters: EatInFilters;
  wheelItems: WheelItem<Recipe>[];
  isLoading: boolean;
  error: string | null;
  winner: Recipe | null;
  setFilters: (f: Partial<EatInFilters>) => void;
  setWheelItems: (items: WheelItem<Recipe>[]) => void;
  addWheelItem: (item: WheelItem<Recipe>) => void;
  removeWheelItem: (id: string) => void;
  setLoading: (v: boolean) => void;
  setError: (e: string | null) => void;
  setWinner: (r: Recipe | null) => void;
  reset: () => void;
}

const defaultEatInFilters: EatInFilters = { cuisines: [], efforts: [] };

export const useEatInStore = create<EatInState>()((set) => ({
  filters: defaultEatInFilters,
  wheelItems: [],
  isLoading: false,
  error: null,
  winner: null,
  setFilters: (f) => set((s) => ({ filters: { ...s.filters, ...f } })),
  setWheelItems: (items) => set({ wheelItems: items }),
  addWheelItem: (item) => set((s) => ({ wheelItems: [...s.wheelItems, item] })),
  removeWheelItem: (id) => set((s) => ({ wheelItems: s.wheelItems.filter((i) => i.id !== id) })),
  setLoading: (v) => set({ isLoading: v }),
  setError: (e) => set({ error: e }),
  setWinner: (r) => set({ winner: r }),
  reset: () => set({ filters: defaultEatInFilters, wheelItems: [], winner: null, error: null }),
}));
