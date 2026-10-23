import { BrowserWindow, clipboard, dialog, ipcMain, shell } from 'electron'
import type { AssetFilter } from '../shared/types'
import * as library from './services/library'

const MEDIA_FILTERS = [
  {
    name: '媒体文件',
    extensions: [
      'mp4', 'mov', 'm4v', 'webm', 'mkv', 'avi', 'wmv', 'flv', 'ts', 'm2ts', 'mpg', 'mpeg', '3gp',
      'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'avif', 'ico', 'tiff', 'tif',
      'mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg', 'wma', 'aiff', 'aif', 'opus'
    ]
  }
]

function parentWindow(e: { sender: Electron.WebContents }): BrowserWindow | null {
  return BrowserWindow.fromWebContents(e.sender)
}

export function registerIpc(): void {
  ipcMain.handle('import:files', async (e) => {
    const win = parentWindow(e)
    const r = await dialog.showOpenDialog(win!, {
      title: '导入素材文件',
      properties: ['openFile', 'multiSelections'],
      filters: MEDIA_FILTERS
    })
    if (r.canceled || r.filePaths.length === 0) return { added: 0 }
    return { added: library.importPaths(r.filePaths, false) }
  })

  ipcMain.handle('import:folder', async (e) => {
    const win = parentWindow(e)
    const r = await dialog.showOpenDialog(win!, {
      title: '导入文件夹',
      properties: ['openDirectory']
    })
    if (r.canceled || r.filePaths.length === 0) return { added: 0 }
    const box = await dialog.showMessageBox(win!, {
      type: 'question',
      message: `导入文件夹：${r.filePaths[0]}`,
      detail: '是否同时导入其子文件夹中的素材？',
      checkboxLabel: '包含子文件夹',
      checkboxChecked: true,
      buttons: ['导入', '取消'],
      defaultId: 0,
      cancelId: 1
    })
    if (box.response !== 0) return { added: 0 }
    return { added: library.importPaths(r.filePaths, box.checkboxChecked) }
  })

  ipcMain.handle('import:paths', (_e, paths: string[], recursive: boolean) => {
    return { added: library.importPaths(paths, recursive) }
  })

  ipcMain.handle('library:list', (_e, filter: AssetFilter) => library.listAssets(filter))
  ipcMain.handle('library:stats', () => library.getStats())
  ipcMain.handle('library:remove', (_e, ids: number[]) => {
    library.removeAssets(ids)
    return true
  })
  ipcMain.handle('library:verify', () => {
    library.verifyAssets()
    return true
  })
  ipcMain.handle('library:retry', () => {
    library.retryFailed()
    return true
  })

  ipcMain.handle('shell:showInFolder', (_e, p: string) => {
    shell.showItemInFolder(p)
    return true
  })
  ipcMain.handle('shell:openPath', (_e, p: string) => {
    void shell.openPath(p)
    return true
  })
  ipcMain.handle('shell:copyPath', (_e, p: string) => {
    clipboard.writeText(p)
    return true
  })

  ipcMain.handle('tags:list', () => library.listTags())
  ipcMain.handle('tags:create', (_e, name: string) => library.createTag(name))
  ipcMain.handle('tags:rename', (_e, id: number, name: string) => {
    library.renameTag(id, name)
    return true
  })
  ipcMain.handle('tags:delete', (_e, id: number) => {
    library.deleteTag(id)
    return true
  })
  ipcMain.handle('tags:addToAssets', (_e, tagId: number, assetIds: number[]) => {
    library.addTagToAssets(tagId, assetIds)
    return true
  })
  ipcMain.handle('tags:removeFromAssets', (_e, tagId: number, assetIds: number[]) => {
    library.removeTagFromAssets(tagId, assetIds)
    return true
  })

  ipcMain.handle('folders:list', () => library.listFolders())
  ipcMain.handle('folders:create', (_e, name: string, parentId: number | null) =>
    library.createFolder(name, parentId)
  )
  ipcMain.handle('folders:rename', (_e, id: number, name: string) => {
    library.renameFolder(id, name)
    return true
  })
  ipcMain.handle('folders:delete', (_e, id: number) => {
    library.deleteFolder(id)
    return true
  })
  ipcMain.handle('folders:addAssets', (_e, folderId: number, assetIds: number[]) => {
    library.addAssetsToFolder(folderId, assetIds)
    return true
  })
  ipcMain.handle('folders:removeAssets', (_e, folderId: number, assetIds: number[]) => {
    library.removeAssetsFromFolder(folderId, assetIds)
    return true
  })
}
