<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Icon from './Icon.vue'
import { useLibrary } from '../store'
import { showPrompt } from '../prompt'
import { formatDuration, formatSize, formatDims } from '../format'
import type { Asset } from '@shared/types'
import type WaveSurfer from 'wavesurfer.js'

const store = useLibrary()
const asset = computed<Asset | null>(() => store.previewAsset)

const videoEl = ref<HTMLVideoElement | null>(null)
const waveEl = ref<HTMLDivElement | null>(null)
const zoomed = ref(false)
const playing = ref(false)
const audioTime = ref(0)
const audioDur = ref(0)

let ws: WaveSurfer | null = null
let wsReady = false
let pendingUrl: string | null = null

const hasPrev = computed(() => store.previewIndex > 0)
const hasNext = computed(() => store.previewIndex >= 0 && store.previewIndex < store.assets.length - 1)

const typeLabel: Record<string, string> = { video: '视频', image: '图片', audio: '音频' }

async function buildWave(url: string): Promise<void> {
  if (!waveEl.value) return
  pendingUrl = url
  const mod = await import('wavesurfer.js')
  if (pendingUrl !== url || !waveEl.value) return
  ws?.destroy()
  ws = null
  wsReady = false
  audioTime.value = 0
  audioDur.value = 0
  playing.value = false
  ws = mod.default.create({
    container: waveEl.value,
    height: 72,
    waveColor: '#4a5268',
    progressColor: '#4f8cff',
    cursorColor: '#8ea9d8',
    barWidth: 2,
    barGap: 1,
    barRadius: 2,
    url
  })
  ws.on('ready', () => {
    wsReady = true
    audioDur.value = ws?.getDuration() ?? 0
  })
  ws.on('timeupdate', (t: number) => {
    audioTime.value = t
  })
  ws.on('finish', () => {
    playing.value = false
  })
}

function togglePlay(): void {
  const a = asset.value
  if (!a) return
  if (a.type === 'video' && videoEl.value) {
    if (videoEl.value.paused) void videoEl.value.play()
    else videoEl.value.pause()
  } else if (a.type === 'audio' && ws && wsReady) {
    void ws.playPause()
    playing.value = !ws.isPlaying()
  }
}

function onVideoPlay(): void {
  playing.value = true
}
function onVideoPause(): void {
  playing.value = false
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'ArrowLeft' && hasPrev.value) store.stepPreview(-1)
  else if (e.key === 'ArrowRight' && hasNext.value) store.stepPreview(1)
  else if (e.key === ' ') {
    e.preventDefault()
    togglePlay()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  void initMedia()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  ws?.destroy()
  ws = null
  pendingUrl = null
})

async function initMedia(): Promise<void> {
  const a = asset.value
  if (a?.type === 'audio') {
    await nextTick()
    await buildWave(`media://asset/${a.id}`)
  }
}

watch(
  () => asset.value?.id,
  () => {
    zoomed.value = false
    playing.value = false
    void initMedia()
  }
)

async function addTag(): Promise<void> {
  const a = asset.value
  if (!a) return
  const name = await showPrompt('添加标签')
  if (!name) return
  await store.createTagAndApply(name, [a.id])
}

async function removeTag(tagId: number): Promise<void> {
  const a = asset.value
  if (!a) return
  await window.api.removeTagFromAssets(tagId, [a.id])
  await store.refresh()
}

function openFolder(): void {
  if (asset.value) void window.api.showInFolder(asset.value.path)
}
function openDefault(): void {
  if (asset.value && !asset.value.missing) void window.api.openPath(asset.value.path)
}
</script>

<template>
  <Teleport to="body">
    <div class="pv-mask" @mousedown.self="store.closePreview()">
      <div class="pv-top">
        <div class="pv-title">
          <span class="pv-type">{{ typeLabel[asset?.type ?? ''] }}</span>
          <span class="pv-name">{{ asset?.filename }}</span>
        </div>
        <span class="pv-counter" v-if="store.assets.length > 1">{{ store.previewIndex + 1 }} / {{ store.assets.length }}</span>
        <button class="icon-btn" title="关闭 (Esc)" @click="store.closePreview()">
          <Icon name="close" :size="16" />
        </button>
      </div>

      <button v-if="hasPrev" class="nav left" title="上一个 (←)" @click="store.stepPreview(-1)">
        <Icon name="left" :size="22" />
      </button>
      <button v-if="hasNext" class="nav right" title="下一个 (→)" @click="store.stepPreview(1)">
        <Icon name="right" :size="22" />
      </button>

      <div class="pv-body">
        <div v-if="asset?.missing" class="pv-missing">
          <Icon name="missing" :size="42" />
          <div>文件已丢失或被移动</div>
          <button @click="openFolder">打开所在文件夹</button>
        </div>

        <div v-else-if="asset?.type === 'image'" class="pv-image" :class="{ zoomed }" @click="zoomed = !zoomed">
          <img :src="`media://asset/${asset.id}`" draggable="false" :title="zoomed ? '点击适应窗口' : '点击查看原始尺寸'" />
        </div>

        <video
          v-else-if="asset?.type === 'video'"
          ref="videoEl"
          :key="asset.id"
          class="pv-video"
          controls
          autoplay
          :poster="asset.thumb ? `media://thumb/${asset.thumb}` : undefined"
          :src="`media://asset/${asset.id}`"
          @play="onVideoPlay"
          @pause="onVideoPause"
        ></video>

        <div v-else-if="asset?.type === 'audio'" class="pv-audio">
          <div class="audio-icon" :class="{ playing }" @click="togglePlay">
            <Icon name="audio" :size="34" />
          </div>
          <div class="audio-name">{{ asset.filename }}</div>
          <div ref="waveEl" class="wave"></div>
          <div class="audio-time">
            {{ formatDuration(audioTime) || '0:00' }} / {{ formatDuration(audioDur || asset.duration) }}
          </div>
          <div class="audio-tip">空格 播放/暂停 · ←/→ 切换素材</div>
        </div>
      </div>

      <div v-if="asset && !asset.missing" class="pv-bottom">
        <div class="pv-info">
          <span class="path" :title="`${asset.path}（点击打开所在文件夹）`" @click="openFolder">
            {{ asset.path }}
          </span>
          <span class="sep">|</span>
          <span>{{ formatSize(asset.size) }}</span>
          <template v-if="asset.duration">
            <span class="sep">|</span>
            <span>{{ formatDuration(asset.duration) }}</span>
          </template>
          <template v-if="formatDims(asset.width, asset.height)">
            <span class="sep">|</span>
            <span>{{ formatDims(asset.width, asset.height) }}</span>
          </template>
        </div>
        <div class="pv-tags">
          <span v-for="t in asset.tags" :key="t.id" class="tag-chip">
            {{ t.name }}
            <span class="tag-x" title="移除标签" @click="removeTag(t.id)">
              <Icon name="close" :size="9" />
            </span>
          </span>
          <button class="add-tag" @click="addTag"><Icon name="plus" :size="11" /> 标签</button>
          <span class="flex-sp"></span>
          <button class="mini" @click="openFolder">打开所在文件夹</button>
          <button class="mini" @click="openDefault">用默认程序打开</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.pv-mask {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(12, 13, 17, 0.94);
  display: flex;
  flex-direction: column;
}
.pv-top {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  flex-shrink: 0;
}
.pv-title {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}
.pv-type {
  font-size: 11px;
  color: #9db8e8;
  background: rgba(79, 140, 255, 0.16);
  border-radius: 4px;
  padding: 2px 7px;
  flex-shrink: 0;
}
.pv-name {
  font-size: 14.5px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pv-counter {
  color: var(--text-faint);
  font-size: 12px;
  flex-shrink: 0;
}
.icon-btn {
  border: none;
  background: transparent;
  color: var(--text-dim);
  padding: 6px;
  line-height: 0;
}
.icon-btn:hover {
  color: var(--text);
  background: rgba(255, 255, 255, 0.08);
}
.nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
  border: none;
  background: rgba(30, 32, 42, 0.6);
  color: var(--text-dim);
  padding: 14px 8px;
  line-height: 0;
}
.nav:hover {
  color: #fff;
  background: rgba(60, 64, 84, 0.8);
}
.nav.left {
  left: 10px;
}
.nav.right {
  right: 10px;
}
.pv-body {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.pv-image {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
  cursor: zoom-in;
}
.pv-image.zoomed {
  cursor: zoom-out;
}
.pv-image img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
.pv-image.zoomed img {
  max-width: none;
  max-height: none;
}
.pv-video {
  max-width: calc(100% - 90px);
  max-height: 100%;
  outline: none;
}
.pv-missing {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  color: var(--text-dim);
}
.pv-audio {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  width: min(720px, 80vw);
  padding: 20px 0;
}
.audio-icon {
  width: 84px;
  height: 84px;
  border-radius: 50%;
  background: linear-gradient(140deg, #33406b, #23283c);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9db8e8;
  cursor: pointer;
  transition: transform 0.15s;
}
.audio-icon:hover {
  transform: scale(1.05);
}
.audio-icon.playing {
  color: var(--accent);
  animation: pulse 1.4s infinite;
}
@keyframes pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(79, 140, 255, 0.35);
  }
  50% {
    box-shadow: 0 0 0 14px rgba(79, 140, 255, 0);
  }
}
.audio-name {
  font-size: 15px;
  font-weight: 600;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wave {
  width: 100%;
}
.audio-time {
  font-variant-numeric: tabular-nums;
  color: var(--text-dim);
}
.audio-tip {
  font-size: 11.5px;
  color: var(--text-faint);
}
.pv-bottom {
  flex-shrink: 0;
  padding: 10px 16px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-top: 1px solid rgba(51, 54, 74, 0.6);
}
.pv-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-dim);
  flex-wrap: wrap;
}
.path {
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 55vw;
  direction: rtl;
  text-align: left;
}
.path:hover {
  color: var(--accent);
}
.sep {
  color: var(--text-faint);
}
.pv-tags {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #9db8e8;
  background: rgba(79, 140, 255, 0.14);
  border-radius: 5px;
  padding: 3px 8px;
}
.tag-x {
  display: flex;
  cursor: pointer;
  opacity: 0.6;
}
.tag-x:hover {
  opacity: 1;
}
.add-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-dim);
  background: transparent;
  border: 1px dashed var(--border);
  border-radius: 5px;
  padding: 2px 8px;
}
.add-tag:hover {
  color: var(--text);
  border-color: var(--text-faint);
}
.flex-sp {
  flex: 1;
}
.mini {
  font-size: 12px;
  padding: 4px 10px;
}
</style>
