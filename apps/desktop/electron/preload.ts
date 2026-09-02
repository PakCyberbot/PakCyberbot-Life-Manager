import { contextBridge, ipcRenderer } from 'electron';
import type { LifeManagerApi } from '@life-manager/core';

const api: LifeManagerApi = {
  db: {
    list: (table, where) => ipcRenderer.invoke('db:list', table, where),
    get: (table, id) => ipcRenderer.invoke('db:get', table, id),
    create: (table, row) => ipcRenderer.invoke('db:create', table, row),
    update: (table, id, patch) => ipcRenderer.invoke('db:update', table, id, patch),
    remove: (table, id) => ipcRenderer.invoke('db:remove', table, id),
    hardRemove: (table, id) => ipcRenderer.invoke('db:hardRemove', table, id),
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
    openWebsite: (url, title) => ipcRenderer.invoke('system:openWebsite', url, title),
    onBookmarkUpdate: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, update: { id: string; page: number }) => callback(update);
      ipcRenderer.on('book:bookmarkUpdated', listener);
      return () => ipcRenderer.removeListener('book:bookmarkUpdated', listener);
    },
    openLocalPath: (path) => ipcRenderer.invoke('system:openLocalPath', path),
  },
  dialog: {
    pickPdf: () => ipcRenderer.invoke('dialog:pickPdf'),
    pickExecutable: () => ipcRenderer.invoke('dialog:pickExecutable'),
    pickFileOrFolder: (kind) => ipcRenderer.invoke('dialog:pickFileOrFolder', kind),
  },
  media: {
    fetchYouTubeThumbnail: (url) => ipcRenderer.invoke('media:fetchYouTubeThumbnail', url),
    fetchImageAsDataUri: (url) => ipcRenderer.invoke('media:fetchImageAsDataUri', url),
    fetchWikipediaThumbnail: (title, type) => ipcRenderer.invoke('media:fetchWikipediaThumbnail', title, type),
    fetchWebPreview: (url) => ipcRenderer.invoke('media:fetchWebPreview', url),
  },
  drive: {
    status: () => ipcRenderer.invoke('drive:status'),
    connect: () => ipcRenderer.invoke('drive:connect'),
    disconnect: () => ipcRenderer.invoke('drive:disconnect'),
    push: () => ipcRenderer.invoke('drive:push'),
    pull: () => ipcRenderer.invoke('drive:pull'),
  },
  backup: {
    exportDatabase: () => ipcRenderer.invoke('db:export'),
    importDatabase: () => ipcRenderer.invoke('db:import'),
  },
  news: {
    fetch: (categoryId) => ipcRenderer.invoke('news:fetch', categoryId),
  },
  entertainment: {
    generateVerdict: (title, type) => ipcRenderer.invoke('entertainment:generateVerdict', { title, type }),
  },
  earningWays: {
    suggest: () => ipcRenderer.invoke('earningWays:suggest'),
    generateGuide: (title, category) => ipcRenderer.invoke('earningWays:generateGuide', { title, category }),
  },
  jobs: {
    fetch: (searchId) => ipcRenderer.invoke('jobs:fetch', searchId),
  },
  food: {
    generateInfo: (name, quantity) => ipcRenderer.invoke('food:generateInfo', { name, quantity }),
  },
  ai: {
    getStatus: () => ipcRenderer.invoke('ai:getStatus'),
    checkStatus: () => ipcRenderer.invoke('ai:checkStatus'),
    onStatusChanged: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, status: Parameters<typeof callback>[0]) => callback(status);
      ipcRenderer.on('ai:statusChanged', listener);
      return () => ipcRenderer.removeListener('ai:statusChanged', listener);
    },
  },
};

contextBridge.exposeInMainWorld('api', api);
