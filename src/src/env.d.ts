/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>
  export default component
}

import type { Api } from '../../electron/preload'

declare global {
  interface Window {
    api: Api
  }
}
