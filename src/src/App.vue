<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import Sidebar from './components/Sidebar.vue'
import Toolbar from './components/Toolbar.vue'
import AssetGrid from './components/AssetGrid.vue'
import PreviewModal from './components/PreviewModal.vue'
import ContextMenu from './components/ContextMenu.vue'
import InlinePrompt from './components/InlinePrompt.vue'
import Icon from './components/Icon.vue'
import { useLibrary } from './store'
import type { Asset } from '@shared/types'

const store = useLibrary()

const ctx = ref<{ x: number; y: number; assets: Asset[] } | null>(null)

let refreshTimer: ReturnType<typeof setTimeout> | null = null
let offChanged: (() => void) | null = null
let offProgress: (() => void) | null = null

function onGlobalKeydown(e: KeyboardEvent): void {
  const target = e.target as HTMLElement
  const inInput = target.tagName === 'INPUT' || target.tagName === 'SELECT'
  if (e.key === 'Escape') {
    if (store.previewId !== null) store.closePreview()
    else if (inInput) (target as HTMLInputElement).blur()
    else store.clearSelection()
    return
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
    e.preventDefault()
    const el = document.querySelector<HTMLInputElement>('.search-box input')
    el?.focus()
    el?.select()
    return
  }
  if (inInput || store.previewId !== null) return
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
    e.preventDefault()
    store.selectAll()
  } else if (e.key === 'Delete') {
    void store.removeSelected()
  } else if (e.key === ' ' || e.key === 'Enter') {
    if (store.selection.length > 0) {
      e.preventDefault()
      store.openPreview(store.selection[store.selection.length - 1])
    }
  }
}

onMounted(() => {
  void store.refresh()
  offChanged = window.api.onLibraryChanged(() => {
    if (refreshTimer) clearTimeout(refreshTimer)
    refreshTimer = setTimeout(() => void store.refresh(), 250)
  })
  offProgress = window.api.onImportProgress((p) => {
    store.progress = p as typeof store.progress
  })
  window.addEventListener('keydown', onGlobalKeydown)
})

onUnmounted(() => {
  offChanged?.()
  offProgress?.()
  window.removeEventListener('keydown', onGlobalKeydown)
})

function openContextMenu(e: { x: number; y: number; assets: Asset[] }): void {
  ctx.value = { x: e.x, y: e.y, assets: e.assets }
}
</script>

<template>
  <div class="app-layout">
    <Sidebar />
    <div class="main-col">
      <Toolbar />
      <AssetGrid @contextmenu="openContextMenu" />
    </div>

    <PreviewModal v-if="store.previewId !== null" />
    <ContextMenu v-if="ctx" v-bind="ctx" @close="ctx = null" />
    <InlinePrompt />

    <div v-if="store.progress && store.progress.total > 0 && store.progress.done < store.progress.total" class="proc-chip">
      <Icon name="refresh" :size="13" />
      <span>正在处理素材 {{ store.progress.done }}/{{ store.progress.total }}</span>
    </div>

    <div class="toasts">
      <div v-for="t in store.toasts" :key="t.id" class="toast" :class="{ error: t.kind === 'error' }">
        {{ t.msg }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.main-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.proc-chip {
  position: fixed;
  right: 16px;
  bottom: 16px;
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 7px 14px;
  color: var(--text-dim);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.4);
  animation: spin-in 0.2s;
}
.toasts {
  position: fixed;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  z-index: 400;
}
.toast {
  background: #2f3346;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 18px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.45);
  animation: spin-in 0.18s;
}
.toast.error {
  background: #4a2624;
  border-color: var(--danger);
}
@keyframes spin-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
</style>
