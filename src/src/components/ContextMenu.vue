<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import Icon from './Icon.vue'
import { useLibrary } from '../store'
import type { Asset, Folder } from '@shared/types'

const props = defineProps<{ x: number; y: number; assets: Asset[] }>()
const emit = defineEmits<{ close: [] }>()

const store = useLibrary()
const menuEl = ref<HTMLElement | null>(null)
const pos = ref({ left: props.x, top: props.y })
const mode = ref<'main' | 'tags' | 'folders'>('main')
const newTagName = ref('')
const newFolderName = ref('')

const ids = computed(() => props.assets.map((a) => a.id))
const single = computed(() => (props.assets.length === 1 ? props.assets[0] : null))
const anyMissing = computed(() => props.assets.some((a) => a.missing === 1))
const currentFolderId = computed<number | null>(() => {
  const v = store.view
  return typeof v === 'string' && v.startsWith('folder:') ? Number(v.slice(7)) : null
})

const folderTree = computed<{ folder: Folder; depth: number }[]>(() => {
  const out: { folder: Folder; depth: number }[] = []
  const walk = (parentId: number | null, depth: number): void => {
    for (const f of store.folders
      .filter((x) => x.parentId === parentId)
      .sort((a, b) => a.name.localeCompare(b.name, 'zh'))) {
      out.push({ folder: f, depth })
      walk(f.id, depth + 1)
    }
  }
  walk(null, 0)
  return out
})

onMounted(async () => {
  await nextTick()
  const el = menuEl.value
  if (el) {
    const w = el.offsetWidth
    const h = el.offsetHeight
    pos.value.left = Math.min(props.x, window.innerWidth - w - 8)
    pos.value.top = Math.min(props.y, window.innerHeight - h - 8)
  }
  window.addEventListener('mousedown', onOutside, true)
  window.addEventListener('blur', close)
})

onUnmounted(() => {
  window.removeEventListener('mousedown', onOutside, true)
  window.removeEventListener('blur', close)
})

function onOutside(e: MouseEvent): void {
  if (menuEl.value && !menuEl.value.contains(e.target as Node)) close()
}

function close(): void {
  emit('close')
}

async function showInFolder(): Promise<void> {
  const target = single.value ?? props.assets[0]
  if (target) await window.api.showInFolder(target.path)
  close()
}

async function openWithDefault(): Promise<void> {
  if (anyMissing.value) return
  for (const a of props.assets) await window.api.openPath(a.path)
  close()
}

async function copyPath(): Promise<void> {
  const text = props.assets.map((a) => a.path).join('\r\n')
  await window.api.copyPath(text)
  store.toast('路径已复制')
  close()
}

async function removeFromCurrentFolder(): Promise<void> {
  if (currentFolderId.value === null) return
  await window.api.removeAssetsFromFolder(currentFolderId.value, ids.value)
  await store.refresh()
  close()
}

async function removeAssets(): Promise<void> {
  await store.removeSelected()
  close()
}

function tagState(tagId: number): 'all' | 'some' | 'none' {
  const count = props.assets.filter((a) => a.tags.some((t) => t.id === tagId)).length
  if (count === 0) return 'none'
  return count === props.assets.length ? 'all' : 'some'
}

async function toggleTag(tagId: number): Promise<void> {
  if (tagState(tagId) === 'all') await window.api.removeTagFromAssets(tagId, ids.value)
  else await window.api.addTagToAssets(tagId, ids.value)
  await store.refresh()
}

async function createTag(): Promise<void> {
  const name = newTagName.value.trim()
  if (!name) return
  await store.createTagAndApply(name, ids.value)
  newTagName.value = ''
}

async function toggleFolder(folderId: number): Promise<void> {
  const all = props.assets.every((a) => a.folderIds.includes(folderId))
  if (all) await window.api.removeAssetsFromFolder(folderId, ids.value)
  else await window.api.addAssetsToFolder(folderId, ids.value)
  await store.refresh()
}

async function createFolder(): Promise<void> {
  const name = newFolderName.value.trim()
  if (!name) return
  await window.api.createFolder(name, null)
  newFolderName.value = ''
  await store.refresh()
}
</script>

<template>
  <Teleport to="body">
    <div ref="menuEl" class="ctx-menu" :style="{ left: pos.left + 'px', top: pos.top + 'px' }" @contextmenu.prevent>
      <template v-if="mode === 'main'">
        <div class="ctx-head">
          {{ assets.length === 1 ? assets[0].filename : `已选 ${assets.length} 个素材` }}
        </div>
        <button class="ctx-item" @click="showInFolder">
          <Icon name="folder" :size="14" />
          打开所在文件夹
        </button>
        <button class="ctx-item" :class="{ disabled: anyMissing }" @click="openWithDefault">
          <Icon name="play" :size="14" />
          用默认程序打开
        </button>
        <button class="ctx-item" @click="copyPath">
          <Icon name="tag" :size="14" />
          复制路径
        </button>
        <div class="ctx-sep"></div>
        <button class="ctx-item" @click="mode = 'tags'">
          <Icon name="tag" :size="14" />
          管理标签…
        </button>
        <button class="ctx-item" @click="mode = 'folders'">
          <Icon name="folder" :size="14" />
          添加到分类夹…
        </button>
        <button v-if="currentFolderId !== null" class="ctx-item" @click="removeFromCurrentFolder">
          <Icon name="close" :size="14" />
          从当前分类夹移除
        </button>
        <div class="ctx-sep"></div>
        <button class="ctx-item danger" @click="removeAssets">
          <Icon name="trash" :size="14" />
          从素材库移除
        </button>
      </template>

      <template v-else-if="mode === 'tags'">
        <div class="ctx-head back" @click="mode = 'main'">
          <Icon name="left" :size="13" />
          管理标签
        </div>
        <div class="ctx-list">
          <div v-if="store.tags.length === 0" class="ctx-empty">还没有标签，在下方新建</div>
          <button
            v-for="t in store.tags"
            :key="t.id"
            class="ctx-item check-item"
            :class="{ on: tagState(t.id) === 'all' }"
            @click="toggleTag(t.id)"
          >
            <span class="checkbox" :class="{ half: tagState(t.id) === 'some', on: tagState(t.id) === 'all' }"></span>
            {{ t.name }}
          </button>
        </div>
        <div class="ctx-input-row">
          <input v-model="newTagName" type="text" placeholder="新建标签并应用" @keydown.enter="createTag" />
          <button class="primary" @click="createTag">添加</button>
        </div>
      </template>

      <template v-else>
        <div class="ctx-head back" @click="mode = 'main'">
          <Icon name="left" :size="13" />
          添加到分类夹
        </div>
        <div class="ctx-list">
          <div v-if="folderTree.length === 0" class="ctx-empty">还没有分类夹，在下方新建</div>
          <button
            v-for="n in folderTree"
            :key="n.folder.id"
            class="ctx-item check-item"
            :class="{ on: assets.every((a) => a.folderIds.includes(n.folder.id)) }"
            :style="{ paddingLeft: 10 + n.depth * 14 + 'px' }"
            @click="toggleFolder(n.folder.id)"
          >
            <span class="checkbox" :class="{ on: assets.every((a) => a.folderIds.includes(n.folder.id)) }"></span>
            <Icon name="folder" :size="13" />
            {{ n.folder.name }}
          </button>
        </div>
        <div class="ctx-input-row">
          <input v-model="newFolderName" type="text" placeholder="新建分类夹" @keydown.enter="createFolder" />
          <button class="primary" @click="createFolder">新建</button>
        </div>
      </template>
    </div>
  </Teleport>
</template>

<style scoped>
.ctx-menu {
  position: fixed;
  z-index: 250;
  min-width: 200px;
  max-width: 300px;
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 5px;
  box-shadow: 0 10px 36px rgba(0, 0, 0, 0.55);
  animation: ctx-in 0.1s;
}
@keyframes ctx-in {
  from {
    opacity: 0;
    transform: translateY(3px);
  }
  to {
    opacity: 1;
  }
}
.ctx-head {
  font-size: 12px;
  color: var(--text-faint);
  padding: 6px 10px 7px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ctx-head.back {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  color: var(--text-dim);
  border-radius: 6px;
}
.ctx-head.back:hover {
  background: var(--bg-hover);
  color: var(--text);
}
.ctx-item {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  border-radius: 6px;
  padding: 7px 10px;
  font-size: 13px;
  color: var(--text);
}
.ctx-item:hover {
  background: var(--bg-hover);
}
.ctx-item.disabled {
  opacity: 0.4;
  pointer-events: none;
}
.ctx-item.danger {
  color: var(--danger);
}
.ctx-sep {
  height: 1px;
  background: var(--border);
  margin: 5px 8px;
}
.ctx-list {
  max-height: 260px;
  overflow-y: auto;
}
.check-item {
  color: var(--text-dim);
}
.check-item.on {
  color: var(--text);
}
.checkbox {
  width: 14px;
  height: 14px;
  border-radius: 4px;
  border: 1.5px solid var(--text-faint);
  flex-shrink: 0;
  position: relative;
}
.checkbox.on {
  background: var(--accent);
  border-color: var(--accent);
}
.checkbox.on::after {
  content: '';
  position: absolute;
  left: 3.5px;
  top: 1px;
  width: 4px;
  height: 8px;
  border: solid #fff;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}
.checkbox.half {
  background: var(--accent);
  border-color: var(--accent);
  opacity: 0.55;
}
.ctx-empty {
  padding: 8px 10px;
  font-size: 12px;
  color: var(--text-faint);
}
.ctx-input-row {
  display: flex;
  gap: 6px;
  padding: 6px 4px 4px;
  border-top: 1px solid var(--border);
  margin-top: 5px;
}
.ctx-input-row input {
  flex: 1;
  min-width: 0;
  font-size: 12.5px;
  padding: 5px 8px;
}
.ctx-input-row button {
  padding: 5px 12px;
  font-size: 12.5px;
}
</style>
