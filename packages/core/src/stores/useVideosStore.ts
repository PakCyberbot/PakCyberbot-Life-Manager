import { create } from 'zustand';
import { newId, nowIso, type Video, type VideoKind } from '@life-manager/shared';
import { getApi } from '../api';

export interface NewVideoInput {
  url: string;
  kind: VideoKind;
  /** Optional manual title override; auto-fetched from the URL when omitted. */
  title?: string;
}

interface VideosState {
  videos: Video[];
  loading: boolean;
  loaded: boolean;
  fetchVideos: () => Promise<void>;
  addVideo: (input: NewVideoInput) => Promise<Video>;
  updateVideo: (id: string, patch: Partial<Video>) => Promise<void>;
  removeVideo: (id: string) => Promise<void>;
}

export const useVideosStore = create<VideosState>((set, get) => ({
  videos: [],
  loading: false,
  loaded: false,

  async fetchVideos() {
    set({ loading: true });
    const videos = await getApi().db.list<Video>('videos');
    set({ videos, loading: false, loaded: true });
  },

  async addVideo(input) {
    // Best-effort — if the lookup fails (offline, unsupported host, etc.)
    // the video still gets added with whatever title was typed and no thumbnail.
    const meta = await getApi().media.fetchYouTubeThumbnail(input.url).catch(() => null);
    const video: Video = {
      id: newId(),
      title: input.title?.trim() || meta?.title || input.url,
      url: input.url,
      kind: input.kind,
      thumbnail: meta?.thumbnail ?? null,
      status: 'to-watch',
      notes: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      deletedAt: null,
    };
    await getApi().db.create('videos', video);
    set({ videos: [video, ...get().videos] });
    return video;
  },

  async updateVideo(id, patch) {
    const updatedAt = nowIso();
    await getApi().db.update('videos', id, { ...patch, updatedAt });
    set({ videos: get().videos.map((v) => (v.id === id ? { ...v, ...patch, updatedAt } : v)) });
  },

  async removeVideo(id) {
    await getApi().db.remove('videos', id);
    set({ videos: get().videos.filter((v) => v.id !== id) });
  },
}));
