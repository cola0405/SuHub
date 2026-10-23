<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import Icon from './Icon.vue'
import type { Asset } from '@shared/types'
import { formatDuration, formatSize } from '../format'

const props = defineProps<{ asset: Asset; selected: boolean }>()

const thumbUrl = computed<string | null>(() => {
  if (props.asset.thumb) return `media://thumb/${props.asset.thumb}`
  if (props.asset.type === 'image') return `media://asset/${props.asset.id}`
  return null
})

const duration = computed(() => formatDuration(props.asset.duration))

const hoverPlaying = ref(false)
let hoverTimer: ReturnType<typeof setTimeout> | null = null

const hoverable = computed(() => props.asset.type === 'video' && props.asset.missing === 0)

function onEnter(): void {
  if (!hoverable.value) return
  hoverTimer = setTimeout(() => {
    hoverPlaying.value = true
  }, 400)
}

function onLeave(): void {
  if (hoverTimer) {
    clearTimeout(hoverTimer)
    hoverTimer = null
  }
  hoverPlaying.value = false
}

onUnmounted(() => {
  if (hoverTimer) clearTimeout(hoverTimer)
})
</script>

<template>
  <div
    class="card"
    :class="{ selected, missing: asset.missing === 1 }"
    @mouseenter="onEnter"
    @mouseleave="onLeave"
  >
    <div class="thumb">
      <img v-if="thumbUrl" :src="thumbUrl" loading="lazy" draggable="false" />
      <div v-else class="thumb-fallback">
        <Icon :name="asset.type" :size="30" />
      </div>
      <video
        v-if="hoverPlaying"
        class="hover-video"
        :src="`media://asset/${asset.id}`"
        :poster="thumbUrl ?? undefined"
        muted
        autoplay
        loop
        playsinline
      ></video>
      <span v-if="duration" class="duration">{{ duration }}</span>
      <span v-if="asset.missing === 1" class="missing-badge">已丢失</span>
      <span class="type-icon"><Icon :name="asset.type" :size="12" /></span>
      <span class="check" :class="{ on: selected }"></span>
    </div>
    <div class="meta">
      <div class="name" :title="asset.filename">{{ asset.filename }}</div>
      <div class="sub">
        <span v-if="asset.tags.length > 0" class="tag-chips">
          <span v-for="t in asset.tags.slice(0, 3)" :key="t.id" class="chip">{{ t.name }}</span>
          <span v-if="asset.tags.length > 3" class="chip more">+{{ asset.tags.length - 3 }}</span>
        </span>
        <span class="size">{{ formatSize(asset.size) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card {
  border-radius: var(--radius);
  background: var(--bg-card);
  overflow: hidden;
  cursor: pointer;
  border: 2px solid transparent;
  transition: border-color 0.1s, transform 0.1s;
}
.card:hover {
  border-color: #41445c;
}
.card.selected {
  border-color: var(--accent);
}
.thumb {
  position: relative;
  aspect-ratio: 4 / 3;
  background: #14151a;
}
.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.hover-video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  background: #14151a;
}
.thumb-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-faint);
  background: linear-gradient(160deg, #2a2d3d, #20222e);
}
.duration {
  position: absolute;
  right: 5px;
  bottom: 5px;
  background: rgba(0, 0, 0, 0.72);
  border-radius: 4px;
  padding: 1px 6px;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: #fff;
}
.missing-badge {
  position: absolute;
  left: 5px;
  top: 5px;
  background: rgba(224, 86, 79, 0.9);
  border-radius: 4px;
  padding: 1px 6px;
  font-size: 11px;
  color: #fff;
}
.type-icon {
  position: absolute;
  left: 5px;
  bottom: 5px;
  color: rgba(255, 255, 255, 0.75);
  background: rgba(0, 0, 0, 0.45);
  border-radius: 4px;
  padding: 3px;
  display: flex;
}
.check {
  position: absolute;
  right: 6px;
  top: 6px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.7);
  background: rgba(0, 0, 0, 0.3);
  opacity: 0;
  transition: opacity 0.1s;
}
.card:hover .check {
  opacity: 1;
}
.check.on {
  opacity: 1;
  background: var(--accent);
  border-color: var(--accent);
}
.check.on::after {
  content: '';
  position: absolute;
  left: 4px;
  top: 1px;
  width: 5px;
  height: 9px;
  border: solid #fff;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}
.card.missing .thumb img,
.card.missing .thumb-fallback {
  filter: grayscale(1) brightness(0.6);
}
.meta {
  padding: 7px 9px 8px;
}
.name {
  font-size: 12.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sub {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-top: 3px;
  min-height: 16px;
}
.tag-chips {
  display: flex;
  gap: 4px;
  overflow: hidden;
}
.chip {
  font-size: 10.5px;
  color: #9db8e8;
  background: rgba(79, 140, 255, 0.14);
  border-radius: 4px;
  padding: 1px 5px;
  white-space: nowrap;
}
.chip.more {
  color: var(--text-faint);
  background: rgba(255, 255, 255, 0.06);
}
.size {
  font-size: 11px;
  color: var(--text-faint);
  white-space: nowrap;
}
</style>
