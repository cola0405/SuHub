import { reactive } from 'vue'

interface PromptState {
  visible: boolean
  title: string
  hint: string
  value: string
  resolve: ((v: string | null) => void) | null
}

export const promptState = reactive<PromptState>({
  visible: false,
  title: '',
  hint: '',
  value: '',
  resolve: null
})

export function showPrompt(title: string, initial = '', hint = ''): Promise<string | null> {
  return new Promise((resolve) => {
    promptState.resolve?.(null)
    promptState.visible = true
    promptState.title = title
    promptState.hint = hint
    promptState.value = initial
    promptState.resolve = resolve
  })
}

export function resolvePrompt(value: string | null): void {
  const r = promptState.resolve
  promptState.visible = false
  promptState.resolve = null
  r?.(value)
}
