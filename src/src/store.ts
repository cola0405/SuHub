import { defineStore } from 'pinia'
import type { Asset, AssetFilter, Folder, ImportProgress, LibraryStats, SortKey, Tag } from '@shared/types'

export type ViewKey = AssetFilter['view']

export interface Toast {
  id: number
  msg: string
  kind: 'info' | 'error'
}

let toastSeq = 0

export const useLibrary = defineStore('library', {
  state: () => ({
    view: 'all' as ViewKey,
    search: '',
    sort: 'recent' as SortKey,
    assets: [] as Asset[],
    stats: { all: 0, video: 0, image: 0, audio: 0, missing: 0 } as LibraryStats,
    tags: [] as Tag[],
    folders: [] as Folder[],
    selection: [] as number[],
    lastClickedId: null as number | null,
    previewId: null as number | null,
    loading: false,
    progress: null as ImportProgress | null,
    toasts: [] as Toast[]
  }),

  getters: {
    previewIndex(state): number {
      return state.assets.findIndex((a) => a.id === state.previewId)
    },
    previewAsset(): Asset | null {
      const i = this.previewIndex
      return i >= 0 ? this.assets[i] : null
    },
    selectedAssets(state): Asset[] {
      return state.assets.filter((a) => state.selection.includes(a.id))
    }
  },

  actions: {
    toast(msg: string, kind: Toast['kind'] = 'info'): void {
      const id = ++toastSeq
      this.toasts.push({ id, msg, kind })
      setTimeout(() => {
        this.toasts = this.toasts.filter((t) => t.id !== id)
      }, 3200)
    },

    async refresh(): Promise<void> {
      this.loading = true
      try {
        const filter: AssetFilter = { view: this.view, sort: this.sort }
        if (this.search.trim()) filter.search = this.search.trim()
        const [assets, stats, tags, folders] = await Promise.all([
          window.api.listAssets(filter),
          window.api.getStats(),
          window.api.listTags(),
          window.api.listFolders()
        ])
        this.assets = assets
        this.stats = stats
        this.tags = tags
        this.folders = folders
        this.selection = this.selection.filter((id) => assets.some((a) => a.id === id))
        if (this.previewId !== null && !assets.some((a) => a.id === this.previewId)) {
          this.previewId = null
        }
      } finally {
        this.loading = false
      }
    },

    setView(view: ViewKey): void {
      if (this.view === view) return
      this.view = view
      this.selection = []
      this.lastClickedId = null
      void this.refresh()
    },

    setSort(sort: SortKey): void {
      this.sort = sort
      void this.refresh()
    },

    setSearch(search: string): void {
      this.search = search
      void this.refresh()
    },

    clickAsset(id: number, ev: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }): void {
      if (ev.shiftKey && this.lastClickedId !== null) {
        const ids = this.assets.map((a) => a.id)
        const from = ids.indexOf(this.lastClickedId)
        const to = ids.indexOf(id)
        if (from >= 0 && to >= 0) {
          const [lo, hi] = from < to ? [from, to] : [to, from]
          this.selection = [...new Set([...this.selection, ...ids.slice(lo, hi + 1)])]
          return
        }
      }
      if (ev.ctrlKey || ev.metaKey) {
        this.selection = this.selection.includes(id)
          ? this.selection.filter((s) => s !== id)
          : [...this.selection, id]
        this.lastClickedId = id
        return
      }
      this.selection = this.selection.length === 1 && this.selection[0] === id ? [] : [id]
      this.lastClickedId = id
    },

    selectAll(): void {
      this.selection = this.assets.map((a) => a.id)
    },

    clearSelection(): void {
      this.selection = []
    },

    openPreview(id: number): void {
      this.previewId = id
    },

    closePreview(): void {
      this.previewId = null
    },

    stepPreview(delta: number): void {
      const i = this.previewIndex
      if (i < 0) return
      const next = i + delta
      if (next >= 0 && next < this.assets.length) {
        this.previewId = this.assets[next].id
      }
    },

    async importFiles(): Promise<void> {
      const r = await window.api.importFiles()
      if (r.added > 0) {
        this.toast(`已导入 ${r.added} 个素材`)
        await this.refresh()
      } else if (r.added === 0) {
        this.toast('没有新素材（可能已导入过）')
      }
    },

    async importFolder(): Promise<void> {
      const r = await window.api.importFolder()
      if (r.added > 0) {
        this.toast(`已导入 ${r.added} 个素材`)
        await this.refresh()
      } else if (r.added === 0) {
        this.toast('没有新素材（可能已导入过）')
      }
    },

    async importDroppedFiles(files: File[]): Promise<void> {
      const paths = files.map((f) => window.api.pathForFile(f)).filter(Boolean)
      if (paths.length === 0) return
      const r = await window.api.importPaths(paths, false)
      this.toast(`已导入 ${r.added} 个素材`)
      await this.refresh()
    },

    async removeSelected(): Promise<void> {
      const ids = [...this.selection]
      if (ids.length === 0) return
      const label = ids.length === 1 ? `“${this.selectedAssets[0]?.filename ?? ''}”` : `${ids.length} 个素材`
      if (!window.confirm(`确定从素材库移除 ${label} 吗？\n（只删除软件内记录，不会删除硬盘上的文件）`)) return
      await window.api.removeAssets(ids)
      this.selection = []
      await this.refresh()
    },

    async rescanLibrary(): Promise<void> {
      await window.api.verifyAssets()
      await window.api.retryFailed()
      await this.refresh()
    },

    async createTagAndApply(name: string, ids: number[]): Promise<void> {
      const tag = await window.api.createTag(name)
      await window.api.addTagToAssets(tag.id, ids)
      await this.refresh()
    },

    async deleteTag(id: number): Promise<void> {
      await window.api.deleteTag(id)
      if (this.view === (`tag:${id}` as ViewKey)) this.view = 'all'
      await this.refresh()
    }
  }
})
