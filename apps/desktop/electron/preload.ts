import { contextBridge, ipcRenderer } from 'electron';
import type { LifeManagerApi } from '@life-manager/core';

const api: LifeManagerApi = {
  db: {
    list: (table, where) => ipcRenderer.invoke('db:list', table, where),
    get: (table, id) => ipcRenderer.invoke('db:get', table, id),
    create: (table, row) => ipcRenderer.invoke('db:create', table, row),
    update: (table, id, patch) => ipcRenderer.invoke('db:update', table, id, patch),
    remove: (table, id) => ipcRenderer.invoke('db:remove', table, id),
  },
  settings: {
    get: (key) => ipcRenderer.invoke('settings:get', key),
    set: (key, value) => ipcRenderer.invoke('settings:set', key, value),
  },
  system: {
    hostname: () => ipcRenderer.invoke('system:hostname'),
    readFileAsBase64: (path) => ipcRenderer.invoke('system:readFileAsBase64', path),
    detectPdfReader: () => ipcRenderer.invoke('system:detectPdfReader'),
    openBookInApp: (input) => ipcRenderer.invoke('system:openBookInApp', input),
    openBookExternally: (input) => ipcRenderer.invoke('system:openBookExternally', input),
    openExternal: (url) => ipcRenderer.invoke('system:openExternal', url),
    onBookmarkUpdate: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, update: { id: string; page: number }) => callback(update);
      ipcRenderer.on('book:bookmarkUpdated', listener);
      return () => ipcRenderer.removeListener('book:bookmarkUpdated', listener);
    },
  },
  dialog: {
    pickPdf: () => ipcRenderer.invoke('dialog:pickPdf'),
    pickExecutable: () => ipcRenderer.invoke('dialog:pickExecutable'),
  },
  media: {
    fetchYouTubeThumbnail: (url) => ipcRenderer.invoke('media:fetchYouTubeThumbnail', url),
  },
  drive: {
    status: () => ipcRenderer.invoke('drive:status'),
    connect: () => ipcRenderer.invoke('drive:connect'),
    disconnect: () => ipcRenderer.invoke('drive:disconnect'),
    push: () => ipcRenderer.invoke('drive:push'),
    pull: () => ipcRenderer.invoke('drive:pull'),
  },
  news: {
    fetch: (categoryId) => ipcRenderer.invoke('news:fetch', categoryId),
  },
  entertainment: {
    generateVerdict: (title, type) => ipcRenderer.invoke('entertainment:generateVerdict', { title, type }),
  },
};

contextBridge.exposeInMainWorld('api', api);
