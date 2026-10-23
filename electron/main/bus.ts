import { BrowserWindow } from 'electron'

let win: BrowserWindow | null = null

export function setMainWindow(w: BrowserWindow | null): void {
  win = w
}

export function emit(channel: string, payload?: unknown): void {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload)
}
