import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { Asset, AssetFilter, Folder, ImportProgress, LibraryStats, Tag } from '../shared/types'

const subscriptions = new Map<string, Set<(data: unknown) => void>>()
const ALLOWED_CHANNELS = ['library:changed', 'import:progress']

function subscribe(channel: string, cb: (data: unknown) => void): () => void {
  if (!ALLOWED_CHANNELS.includes(channel)) return () => {}
  let set = subscriptions.get(channel)
  if (!set) {
    set = new Set()
    subscriptions.set(channel, set)
    ipcRenderer.on(channel, (_e, data) => {
      for (const fn of set!) fn(data)
    })
  }
  set.add(cb)
  return () => set!.delete(cb)
}

const api = {
  importFiles: (): Promise<{ added: number }> => ipcRenderer.invoke('import:files'),
  importFolder: (): Promise<{ added: number }> => ipcRenderer.invoke('import:folder'),
  importPaths: (paths: string[], recursive: boolean): Promise<{ added: number }> =>
    ipcRenderer.invoke('import:paths', paths, recursive),

  listAssets: (filter: AssetFilter): Promise<Asset[]> => ipcRenderer.invoke('library:list', filter),
  getStats: (): Promise<LibraryStats> => ipcRenderer.invoke('library:stats'),
  removeAssets: (ids: number[]): Promise<boolean> => ipcRenderer.invoke('library:remove', ids),
  verifyAssets: (): Promise<boolean> => ipcRenderer.invoke('library:verify'),
  retryFailed: (): Promise<boolean> => ipcRenderer.invoke('library:retry'),

  showInFolder: (p: string): Promise<boolean> => ipcRenderer.invoke('shell:showInFolder', p),
  openPath: (p: string): Promise<boolean> => ipcRenderer.invoke('shell:openPath', p),
  copyPath: (p: string): Promise<boolean> => ipcRenderer.invoke('shell:copyPath', p),

  listTags: (): Promise<Tag[]> => ipcRenderer.invoke('tags:list'),
  createTag: (name: string): Promise<Tag> => ipcRenderer.invoke('tags:create', name),
  renameTag: (id: number, name: string): Promise<boolean> => ipcRenderer.invoke('tags:rename', id, name),
  deleteTag: (id: number): Promise<boolean> => ipcRenderer.invoke('tags:delete', id),
  addTagToAssets: (tagId: number, ids: number[]): Promise<boolean> =>
    ipcRenderer.invoke('tags:addToAssets', tagId, ids),
  removeTagFromAssets: (tagId: number, ids: number[]): Promise<boolean> =>
    ipcRenderer.invoke('tags:removeFromAssets', tagId, ids),

  listFolders: (): Promise<Folder[]> => ipcRenderer.invoke('folders:list'),
  createFolder: (name: string, parentId: number | null): Promise<Folder> =>
    ipcRenderer.invoke('folders:create', name, parentId),
  renameFolder: (id: number, name: string): Promise<boolean> =>
    ipcRenderer.invoke('folders:rename', id, name),
  deleteFolder: (id: number): Promise<boolean> => ipcRenderer.invoke('folders:delete', id),
  addAssetsToFolder: (folderId: number, ids: number[]): Promise<boolean> =>
    ipcRenderer.invoke('folders:addAssets', folderId, ids),
  removeAssetsFromFolder: (folderId: number, ids: number[]): Promise<boolean> =>
    ipcRenderer.invoke('folders:removeAssets', folderId, ids),

  pathForFile: (file: File): string => webUtils.getPathForFile(file),

  onLibraryChanged: (cb: () => void): (() => void) => subscribe('library:changed', cb),
  onImportProgress: (cb: (p: ImportProgress) => void): (() => void) =>
    subscribe('import:progress', cb as (data: unknown) => void)
}

contextBridge.exposeInMainWorld('api', api)
export type Api = typeof api
