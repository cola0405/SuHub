<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { promptState, resolvePrompt } from '../prompt'

const inputEl = ref<HTMLInputElement | null>(null)

watch(
  () => promptState.visible,
  async (v) => {
    if (v) {
      await nextTick()
      inputEl.value?.focus()
      inputEl.value?.select()
    }
  }
)

function submit(): void {
  const v = promptState.value.trim()
  if (v) resolvePrompt(v)
}
</script>

<template>
  <Teleport to="body">
    <div v-if="promptState.visible" class="prompt-mask" @mousedown.self="resolvePrompt(null)">
      <div class="prompt-box">
        <div class="prompt-title">{{ promptState.title }}</div>
        <input
          ref="inputEl"
          v-model="promptState.value"
          type="text"
          @keydown.enter.prevent="submit"
          @keydown.esc="resolvePrompt(null)"
        />
        <div v-if="promptState.hint" class="prompt-hint">{{ promptState.hint }}</div>
        <div class="prompt-actions">
          <button @click="resolvePrompt(null)">取消</button>
          <button class="primary" @click="submit">确定</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.prompt-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
}
.prompt-box {
  width: 360px;
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 18px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
}
.prompt-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
}
.prompt-box input {
  width: 100%;
}
.prompt-hint {
  margin-top: 8px;
  color: var(--text-faint);
  font-size: 12px;
}
.prompt-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}
</style>
