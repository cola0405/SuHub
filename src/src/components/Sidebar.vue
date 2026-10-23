<script setup lang="ts">
import { computed } from 'vue'
import Icon from './Icon.vue'
import { useLibrary, type ViewKey } from '../store'
import { showPrompt } from '../prompt'
import type { Folder } from '@shared/types'
import logoUrl from '../assets/logo.png'

const store = useLibrary()

interface Entry {
  key: ViewKey
  label: string
  icon: string
  count?: number
}

const entries = computed<Entry[]>(() => [
  { key: 'all', label: '全部素材', icon: 'all', count: store.stats.all },
  { key: 'video', label: '视频', icon: 'video', count: store.stats.video },
  { key: 'image', label: '图片', icon: 'image', count: store.stats.image },
  { key: 'audio', label: '音频', icon: 'audio', count: store.stats.audio }
])

interface FolderNode {
  folder: Folder
  depth: number
}

const folderTree = computed<FolderNode[]>(() => {
  const out: FolderNode[] = []
  const walk = (parentId: number | null, depth: number): void => {
    const children = store.folders
      .filter((f) => f.parentId === parentId)
      .sort((a, b) => a.name.localeCompare(b.name, 'zh'))
    for (const f of children) {
      out.push({ folder: f, depth })
      walk(f.id, depth + 1)
    }
  }
  walk(null, 0)
  return out
})

async function newRootFolder(): Promise<void> {
  const name = await showPrompt('新建分类夹', '', '分类夹只用于软件内分组，不会移动硬盘上的文件')
  if (!name) return
  await window.api.createFolder(name, null)
  await store.refresh()
}

async function newSubFolder(parent: Folder): Promise<void> {
  const name = await showPrompt(`在“${parent.name}”内新建分类夹`)
  if (!name) return
  await window.api.createFolder(name, parent.id)
  await store.refresh()
}

async function renameFolder(f: Folder): Promise<void> {
  const name = await showPrompt('重命名分类夹', f.name)
  if (!name) return
  await window.api.renameFolder(f.id, name)
  await store.refresh()
}

async function deleteFolder(f: Folder): Promise<void> {
  if (!window.confirm(`删除分类夹“${f.name}”？\n其中的子夹也会删除，素材记录保留。`)) return
  await window.api.deleteFolder(f.id)
  if (store.view === (`folder:${f.id}` as ViewKey)) store.setView('all')
  else await store.refresh()
}

async function renameTag(id: number, name: string): Promise<void> {
  const v = await showPrompt('重命名标签', name)
  if (!v) return
  await window.api.renameTag(id, v)
  await store.refresh()
}
</script>

<template>
  <aside class="sidebar">
    <div class="brand">
      <img class="brand-logo" :src="logoUrl" alt="SuHub" draggable="false" />
      <span>SuHub</span>
    </div>

    <div class="section">
      <div class="section-title">素材</div>
      <div
        v-for="e in entries"
        :key="e.key"
        class="row"
        :class="{ active: store.view === e.key }"
        @click="store.setView(e.key)"
      >
        <Icon :name="e.icon" :size="15" />
        <span class="row-label">{{ e.label }}</span>
        <span class="row-count">{{ e.count }}</span>
      </div>
      <div
        v-if="store.stats.missing > 0"
        class="row missing"
        :class="{ active: store.view === 'missing' }"
        @click="store.setView('missing')"
      >
        <Icon name="missing" :size="15" />
        <span class="row-label">文件丢失</span>
        <span class="row-count">{{ store.stats.missing }}</span>
      </div>
    </div>

    <div class="section grow">
      <div class="section-title">
        分类夹
        <button class="icon-btn" title="新建分类夹" @click="newRootFolder">
          <Icon name="plus" :size="12" />
        </button>
      </div>
      <div class="section-body">
        <div v-if="folderTree.length === 0" class="empty-hint">尚无分类夹</div>
        <div
          v-for="n in folderTree"
          :key="n.folder.id"
          class="row"
          :class="{ active: store.view === (`folder:${n.folder.id}` as ViewKey) }"
          :style="{ paddingLeft: 10 + n.depth * 16 + 'px' }"
          @click="store.setView(`folder:${n.folder.id}` as ViewKey)"
        >
          <Icon name="folder" :size="15" />
          <span class="row-label" :title="n.folder.name">{{ n.folder.name }}</span>
          <span class="row-count">{{ n.folder.count }}</span>
          <span class="row-actions" @click.stop>
            <button class="icon-btn" title="新建子分类夹" @click="newSubFolder(n.folder)">
              <Icon name="plus" :size="11" />
            </button>
            <button class="icon-btn" title="重命名" @click="renameFolder(n.folder)">
              <Icon name="pencil" :size="11" />
            </button>
            <button class="icon-btn" title="删除" @click="deleteFolder(n.folder)">
              <Icon name="trash" :size="11" />
            </button>
          </span>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">标签</div>
      <div class="section-body">
        <div v-if="store.tags.length === 0" class="empty-hint">右键素材可添加标签</div>
        <div
          v-for="t in store.tags"
          :key="t.id"
          class="row"
          :class="{ active: store.view === (`tag:${t.id}` as ViewKey) }"
          @click="store.setView(`tag:${t.id}` as ViewKey)"
        >
          <Icon name="tag" :size="14" />
          <span class="row-label" :title="t.name">{{ t.name }}</span>
          <span class="row-count">{{ t.count }}</span>
          <span class="row-actions" @click.stop>
            <button class="icon-btn" title="重命名" @click="renameTag(t.id, t.name)">
              <Icon name="pencil" :size="11" />
            </button>
            <button class="icon-btn" title="删除标签" @click="store.deleteTag(t.id)">
              <Icon name="close" :size="11" />
            </button>
          </span>
        </div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 208px;
  flex-shrink: 0;
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  padding: 10px 8px;
  overflow: hidden;
}
.brand {
  font-size: 15px;
  font-weight: 700;
  padding: 4px 8px 14px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.brand-logo {
  width: 22px;
  height: 22px;
  border-radius: 5px;
  display: block;
}
.section {
  margin-bottom: 14px;
}
.section.grow {
  flex: 1;
  min-height: 60px;
  display: flex;
  flex-direction: column;
}
.section-title {
  font-size: 11px;
  color: var(--text-faint);
  padding: 6px 8px 4px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.section-body {
  overflow-y: auto;
  min-height: 0;
}
.row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-dim);
  position: relative;
}
.row:hover {
  background: var(--bg-hover);
  color: var(--text);
}
.row.active {
  background: var(--accent-dim);
  color: #dbe7ff;
}
.row.missing .row-count {
  color: var(--danger);
}
.row-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.row-count {
  font-size: 11px;
  color: var(--text-faint);
}
.row.active .row-count {
  color: #9db8e8;
}
.row-actions {
  display: none;
  gap: 2px;
  position: absolute;
  right: 6px;
  background: inherit;
}
.row:hover .row-actions {
  display: flex;
}
.row:hover .row-actions {
  background: var(--bg-hover);
}
.row.active:hover .row-actions {
  background: var(--accent-dim);
}
.row:hover .row-count {
  visibility: hidden;
}
.icon-btn {
  padding: 2px;
  border: none;
  background: transparent;
  color: var(--text-dim);
  line-height: 0;
}
.icon-btn:hover {
  color: var(--text);
  background: rgba(255, 255, 255, 0.08);
}
.empty-hint {
  padding: 6px 8px;
  font-size: 12px;
  color: var(--text-faint);
}
</style>
