<script setup lang="ts">
import { computed, reactive } from 'vue'
import AssetCard from './AssetCard.vue'
import Icon from './Icon.vue'
import { useLibrary } from '../store'
import type { Asset } from '@shared/types'

const emit = defineEmits<{ contextmenu: [{ x: number; y: number; assets: Asset[] }] }>()
const store = useLibrary()

const drag = reactive({ over: false, depth: 0 })

const isEmpty = computed(
  () => !store.loading && store.assets.length === 0
)

function onCardClick(asset: Asset, ev: MouseEvent): void {
  store.clickAsset(asset.id, ev)
}

function onCardContext(asset: Asset, ev: MouseEvent): void {
  ev.preventDefault()
  ev.stopPropagation()
  if (!store.selection.includes(asset.id)) {
    store.selection = [asset.id]
    store.lastClickedId = asset.id
  }
  emit('contextmenu', {
    x: ev.clientX,
    y: ev.clientY,
    assets: store.assets.filter((a) => store.selection.includes(a.id))
  })
}

function onGridContext(ev: MouseEvent): void {
  ev.preventDefault()
  store.clearSelection()
}

function hasDirEntry(e: DragEvent): boolean {
  const items = e.dataTransfer?.items
  if (!items) return false
  for (const it of items) {
    const entry = it.webkitGetAsEntry?.()
    if (entry && entry.isDirectory) return true
  }
  return false
}

function onDragOver(ev: DragEvent): void {
  if (!ev.dataTransfer?.types.includes('Files')) return
  ev.preventDefault()
  ev.dataTransfer.dropEffect = 'copy'
  drag.over = true
}

function onDrop(ev: DragEvent): void {
  ev.preventDefault()
  drag.over = false
  drag.depth = 0
  if (hasDirEntry(ev)) {
    store.toast('暂不支持拖入文件夹，请点击“导入文件夹”按钮')
    return
  }
  const files = Array.from(ev.dataTransfer?.files ?? [])
  if (files.length > 0) void store.importDroppedFiles(files)
}
</script>

<template>
  <div
    class="grid-scroll"
    @contextmenu="onGridContext"
    @dragenter="drag.depth++; drag.over = true"
    @dragover="onDragOver"
    @dragleave="drag.depth--; if (drag.depth <= 0) drag.over = false"
    @drop="onDrop"
  >
    <div v-if="store.assets.length > 0" class="grid">
      <div
        v-for="a in store.assets"
        :key="a.id"
        @click="onCardClick(a, $event)"
        @dblclick="store.openPreview(a.id)"
        @contextmenu="onCardContext(a, $event)"
      >
        <AssetCard :asset="a" :selected="store.selection.includes(a.id)" />
      </div>
    </div>

    <div v-if="isEmpty" class="empty">
      <div class="empty-icon"><Icon name="all" :size="40" /></div>
      <div class="empty-title">还没有素材</div>
      <div class="empty-desc">导入文件或文件夹开始使用，也可以直接把素材拖进来</div>
      <div class="empty-actions">
        <button class="primary" @click="store.importFiles()">导入文件</button>
        <button @click="store.importFolder()">导入文件夹</button>
      </div>
      <div class="empty-desc dim">素材只登记路径，不会复制或移动原文件</div>
    </div>

    <div v-if="drag.over" class="drop-mask">
      <div class="drop-box">
        <Icon name="plus" :size="28" />
        <div>松开鼠标导入素材</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.grid-scroll {
  flex: 1;
  overflow-y: auto;
  position: relative;
  min-height: 0;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(185px, 1fr));
  gap: 12px;
  padding: 14px;
}
.empty {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--text-dim);
}
.empty-icon {
  color: var(--text-faint);
  margin-bottom: 4px;
}
.empty-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--text);
}
.empty-desc {
  font-size: 12.5px;
  color: var(--text-dim);
}
.empty-desc.dim {
  color: var(--text-faint);
  margin-top: 18px;
}
.empty-actions {
  display: flex;
  gap: 10px;
  margin-top: 10px;
}
.drop-mask {
  position: absolute;
  inset: 0;
  background: rgba(23, 24, 29, 0.82);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 5;
}
.drop-box {
  border: 2px dashed var(--accent);
  border-radius: 14px;
  padding: 34px 60px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--accent);
  font-size: 14px;
  background: rgba(79, 140, 255, 0.06);
}
</style>
