<script setup lang="ts">
import { ref, watch } from 'vue'
import Icon from './Icon.vue'
import { useLibrary } from '../store'
import type { SortKey } from '@shared/types'

const store = useLibrary()
const localSearch = ref(store.search)

let timer: ReturnType<typeof setTimeout> | null = null
watch(localSearch, (v) => {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => store.setSearch(v), 250)
})

const viewLabel: Record<string, string> = {
  all: '全部素材',
  video: '视频',
  image: '图片',
  audio: '音频',
  missing: '文件丢失'
}

function currentLabel(): string {
  const v = store.view
  if (typeof v === 'string' && v.startsWith('tag:')) {
    const t = store.tags.find((x) => x.id === Number(v.slice(4)))
    return `标签：${t?.name ?? ''}`
  }
  if (typeof v === 'string' && v.startsWith('folder:')) {
    const f = store.folders.find((x) => x.id === Number(v.slice(7)))
    return `分类夹：${f?.name ?? ''}`
  }
  return viewLabel[v] ?? ''
}
</script>

<template>
  <div class="toolbar">
    <div class="left">
      <button class="primary" @click="store.importFiles()">导入文件</button>
      <button @click="store.importFolder()">导入文件夹</button>
      <button v-if="store.view === 'missing'" title="重新检查文件是否存在，并重试处理失败的素材" @click="store.rescanLibrary()">
        <Icon name="refresh" :size="13" style="vertical-align: -2px" />
        重新校验
      </button>
      <span class="view-label">{{ currentLabel() }}</span>
    </div>

    <div class="right">
      <span class="meta">
        {{ store.assets.length }} 个素材<template v-if="store.selection.length > 0"> · 已选 {{ store.selection.length }}</template>
      </span>
      <select :value="store.sort" @change="store.setSort(($event.target as HTMLSelectElement).value as SortKey)">
        <option value="recent">最近导入</option>
        <option value="name">文件名</option>
        <option value="size">大小</option>
        <option value="duration">时长</option>
      </select>
      <div class="search-box">
        <Icon name="search" :size="13" />
        <input
          v-model="localSearch"
          type="text"
          placeholder="搜索文件名或标签 (Ctrl+F)"
          @keydown.esc="localSearch = ''; ($event.target as HTMLInputElement).blur()"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.view-label {
  color: var(--text-faint);
  font-size: 12px;
  margin-left: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
.meta {
  color: var(--text-faint);
  font-size: 12px;
  white-space: nowrap;
}
.search-box {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0 8px;
  color: var(--text-faint);
}
.search-box:focus-within {
  border-color: var(--accent);
}
.search-box input {
  border: none;
  background: transparent;
  padding: 6px 0;
  width: 200px;
}
</style>
