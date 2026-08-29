import { create } from 'zustand';
import { newId, nowIso, type JobListing, type JobSearch } from '@life-manager/shared';
import { getApi } from '../api';

interface JobsState {
  searches: JobSearch[];
  listingsBySearch: Record<string, JobListing[]>;
  loadingBySearch: Record<string, boolean>;
  errorBySearch: Record<string, string | null>;
  loaded: boolean;

  fetchSearches: () => Promise<void>;
  fetchCachedListings: (searchId: string) => Promise<void>;
  addSearch: (label: string, keywords: string, prompt: string) => Promise<void>;
  updateSearch: (id: string, patch: Partial<JobSearch>) => Promise<void>;
  removeSearch: (id: string) => Promise<void>;
  /** Calls out to the multi-source fetch + AI ranking pipeline in main. */
  refreshSearch: (id: string) => Promise<void>;
}

export const useJobsStore = create<JobsState>((set, get) => ({
  searches: [],
  listingsBySearch: {},
  loadingBySearch: {},
  errorBySearch: {},
  loaded: false,

  async fetchSearches() {
    const searches = await getApi().db.list<JobSearch>('jobSearches');
    set({ searches, loaded: true });
  },

  async fetchCachedListings(searchId) {
    const listings = await getApi().db.list<JobListing>('jobListings', { searchId });
    set({ listingsBySearch: { ...get().listingsBySearch, [searchId]: listings } });
  },

  async addSearch(label, keywords, prompt) {
    const search: JobSearch = {
      id: newId(),
      label,
      keywords,
      prompt: prompt || null,
      lastFetchedAt: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      deletedAt: null,
    };
    await getApi().db.create('jobSearches', search);
    set({ searches: [search, ...get().searches] });
  },

  async updateSearch(id, patch) {
    const updatedAt = nowIso();
    await getApi().db.update('jobSearches', id, { ...patch, updatedAt });
    set({ searches: get().searches.map((s) => (s.id === id ? { ...s, ...patch, updatedAt } : s)) });
  },

  async removeSearch(id) {
    await getApi().db.remove('jobSearches', id);
    set({ searches: get().searches.filter((s) => s.id !== id) });
  },

  async refreshSearch(id) {
    set({
      loadingBySearch: { ...get().loadingBySearch, [id]: true },
      errorBySearch: { ...get().errorBySearch, [id]: null },
    });
    const result = await getApi().jobs.fetch(id);
    if (result.ok) {
      set({
        listingsBySearch: { ...get().listingsBySearch, [id]: (result.jobs as JobListing[]) ?? [] },
        searches: get().searches.map((s) => (s.id === id ? { ...s, lastFetchedAt: nowIso() } : s)),
      });
    } else {
      set({ errorBySearch: { ...get().errorBySearch, [id]: result.error ?? 'Could not fetch jobs.' } });
    }
    set({ loadingBySearch: { ...get().loadingBySearch, [id]: false } });
  },
}));
