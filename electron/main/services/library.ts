import { existsSync, readdirSync, statSync, unlinkSync } from 'fs'
import { basename, extname, resolve } from 'path'
import type { Asset, AssetFilter, AssetType, Folder, LibraryStats, Tag } from '../../shared/types'
import { getDb, thumbsDir } from '../db'
import { emit } from '../bus'
import { makeThumbnail, probe } from './ffmpeg'

const VIDEO_EXTS = new Set(['mp4', 'mov', 'm4v', 'webm', 'mkv', 'avi', 'wmv', 'flv', 'ts', 'm2ts', 'mpg', 'mpeg', '3gp'])
const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'avif', 'ico', 'tiff', 'tif'])
const AUDIO_EXTS = new Set(['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg', 'wma', 'aiff', 'aif', 'opus'])

export function classifyExt(ext: string): AssetType | null {
  if (VIDEO_EXTS.has(ext)) return 'video'
  if (IMAGE_EXTS.has(ext)) return 'image'
  if (AUDIO_EXTS.has(ext)) return 'audio'
  return null
}

// ---------- 导入 ----------

export function importPaths(inputs: string[], recursive: boolean): number {
  const files: string[] = []
  const collect = (p: string): void => {
    const st = statSync(p, { throwIfNoEntry: false })
    if (!st) return
    if (st.isFile()) {
      files.push(p)
    } else if (st.isDirectory()) {
      for (const entry of readdirSync(p)) {
        const child = resolve(p, entry)
        const cst = statSync(child, { throwIfNoEntry: false })
        if (!cst) continue
        if (cst.isDirectory()) {
          if (recursive) collect(child)
        } else {
          files.push(child)
        }
      }
    }
  }
  for (const p of inputs) collect(p)

  const ins = getDb().prepare(
    `INSERT OR IGNORE INTO assets (path, filename, ext, type, size, missing, created_at)
     VALUES (?, ?, ?, ?, ?, 0, ?)`
  )
  let added = 0
  for (const f of files) {
    const ext = extname(f).slice(1).toLowerCase()
    const type = classifyExt(ext)
    if (!type) continue
    const st = statSync(f, { throwIfNoEntry: false })
    if (!st || !st.isFile()) continue
    const r = ins.run(resolve(f), basename(f), ext, type, st.size, Date.now())
    if (r.changes > 0) added++
  }
  if (added > 0) kickQueue()
  return added
}

// ---------- 后台处理队列（探测元数据 + 生成缩略图） ----------

let queueRunning = false
let queueDone = 0
let queueTotal = 0

interface PendingRow {
  id: number
  path: string
  filename: string
  type: AssetType
}

function pendingSql(): PendingRow[] {
  return getDb()
    .prepare(
      `SELECT id, path, filename, type FROM assets
       WHERE missing = 0
         AND ((type != 'audio' AND thumb IS NULL) OR (type != 'image' AND duration IS NULL))
       ORDER BY id`
    )
    .all() as PendingRow[]
}

export function kickQueue(): void {
  void processQueue()
}

async function processQueue(): Promise<void> {
  if (queueRunning) return
  queueRunning = true
  queueDone = 0
  queueTotal = 0
  try {
    for (;;) {
      const pending = pendingSql()
      if (pending.length === 0) break
      queueTotal += pending.length
      emit('import:progress', { phase: 'process', done: queueDone, total: queueTotal, label: '' })
      for (const a of pending) {
        try {
          let info: { duration: number | null; width: number | null; height: number | null }
          try {
            info = await probe(a.path)
          } catch (err) {
            console.error('元数据探测失败:', a.path, err)
            info = { duration: null, width: null, height: null }
            getDb()
              .prepare('UPDATE assets SET duration = -1 WHERE id = ? AND duration IS NULL')
              .run(a.id)
          }
          if (info.duration !== null || info.width !== null) {
            getDb()
              .prepare(
                'UPDATE assets SET duration = COALESCE(?, duration), width = COALESCE(?, width), height = COALESCE(?, height) WHERE id = ?'
              )
              .run(info.duration, info.width, info.height, a.id)
          }
          if (a.type !== 'audio') {
            try {
              const thumb = await makeThumbnail(a.path, a.type)
              getDb().prepare('UPDATE assets SET thumb = ? WHERE id = ?').run(thumb, a.id)
            } catch (err) {
              console.error('缩略图生成失败:', a.path, err)
              getDb()
                .prepare(`UPDATE assets SET thumb = '' WHERE id = ? AND thumb IS NULL`)
                .run(a.id)
            }
          }
        } finally {
          queueDone++
          emit('import:progress', {
            phase: 'process',
            done: queueDone,
            total: queueTotal,
            label: a.filename
          })
          emit('library:changed', { ids: [a.id] })
        }
      }
    }
  } finally {
    queueRunning = false
    emit('import:progress', { phase: 'process', done: queueTotal, total: queueTotal, label: '' })
  }
}

// ---------- 校验文件存在性 ----------

export function verifyAssets(): void {
  const rows = getDb().prepare('SELECT id, path, missing FROM assets').all() as {
    id: number
    path: string
    missing: number
  }[]
  const upd = getDb().prepare('UPDATE assets SET missing = ? WHERE id = ?')
  const changed: number[] = []
  for (const r of rows) {
    const m = existsSync(r.path) ? 0 : 1
    if (m !== r.missing) {
      upd.run(m, r.id)
      changed.push(r.id)
    }
  }
  if (changed.length > 0) emit('library:changed', { ids: changed })
}

export function retryFailed(): void {
  getDb()
    .prepare(`UPDATE assets SET thumb = NULL, duration = NULL WHERE thumb = '' OR duration = -1`)
    .run()
  kickQueue()
}

// ---------- 查询 ----------

interface RawAsset {
  id: number
  path: string
  filename: string
  ext: string
  type: AssetType
  size: number
  duration: number | null
  width: number | null
  height: number | null
  thumb: string | null
  missing: number
  created_at: number
}

function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => '\\' + c)
}

function descendantFolderIds(folderId: number): number[] {
  const all = getDb().prepare('SELECT id, parent_id FROM folders').all() as {
    id: number
    parent_id: number | null
  }[]
  const result = [folderId]
  let frontier = [folderId]
  while (frontier.length > 0) {
    const next = all.filter((f) => f.parent_id !== null && frontier.includes(f.parent_id)).map((f) => f.id)
    result.push(...next)
    frontier = next
  }
  return result
}

export function listAssets(filter: AssetFilter): Asset[] {
  const where: string[] = []
  const params: unknown[] = []

  if (filter.view === 'missing') {
    where.push('missing = 1')
  } else if (filter.view === 'video' || filter.view === 'image' || filter.view === 'audio') {
    where.push('missing = 0 AND type = ?')
    params.push(filter.view)
  } else if (filter.view.startsWith('tag:')) {
    where.push('missing = 0 AND id IN (SELECT asset_id FROM asset_tags WHERE tag_id = ?)')
    params.push(Number(filter.view.slice(4)))
  } else if (filter.view.startsWith('folder:')) {
    const ids = descendantFolderIds(Number(filter.view.slice(7)))
    where.push(`missing = 0 AND id IN (SELECT asset_id FROM asset_folders WHERE folder_id IN (${ids.map(() => '?').join(',')}))`)
    params.push(...ids)
  } else {
    where.push('missing = 0')
  }

  if (filter.search) {
    const q = `%${escapeLike(filter.search)}%`
    where.push(
      `(filename LIKE ? ESCAPE '\\' OR EXISTS (
        SELECT 1 FROM asset_tags at JOIN tags t ON t.id = at.tag_id
        WHERE at.asset_id = assets.id AND t.name LIKE ? ESCAPE '\\'))`
    )
    params.push(q, q)
  }

  const order =
    {
      recent: 'created_at DESC, id DESC',
      name: 'filename COLLATE NOCASE ASC',
      size: 'size DESC',
      duration: 'duration IS NULL, duration = -1, duration DESC'
    }[filter.sort ?? 'recent'] ?? 'created_at DESC'

  const rows = getDb()
    .prepare(`SELECT * FROM assets WHERE ${where.join(' AND ')} ORDER BY ${order}`)
    .all(...params) as RawAsset[]

  const tagMap = new Map<number, { id: number; name: string }[]>()
  for (const r of getDb()
    .prepare('SELECT at.asset_id, t.id, t.name FROM asset_tags at JOIN tags t ON t.id = at.tag_id')
    .all() as { asset_id: number; id: number; name: string }[]) {
    const list = tagMap.get(r.asset_id) ?? []
    list.push({ id: r.id, name: r.name })
    tagMap.set(r.asset_id, list)
  }
  const folderMap = new Map<number, number[]>()
  for (const r of getDb()
    .prepare('SELECT asset_id, folder_id FROM asset_folders')
    .all() as { asset_id: number; folder_id: number }[]) {
    const list = folderMap.get(r.asset_id) ?? []
    list.push(r.folder_id)
    folderMap.set(r.asset_id, list)
  }

  return rows.map((r) => ({
    id: r.id,
    path: r.path,
    filename: r.filename,
    ext: r.ext,
    type: r.type,
    size: r.size,
    duration: r.duration && r.duration > 0 ? r.duration : null,
    width: r.width,
    height: r.height,
    thumb: r.thumb && r.thumb.length > 0 ? r.thumb : null,
    missing: r.missing,
    createdAt: r.created_at,
    tags: tagMap.get(r.id) ?? [],
    folderIds: folderMap.get(r.id) ?? []
  }))
}

export function getStats(): LibraryStats {
  const counts = { all: 0, video: 0, image: 0, audio: 0, missing: 0 }
  const rows = getDb()
    .prepare('SELECT type, missing, COUNT(*) AS n FROM assets GROUP BY type, missing')
    .all() as { type: AssetType; missing: number; n: number }[]
  for (const r of rows) {
    if (r.missing) counts.missing += r.n
    else {
      counts.all += r.n
      counts[r.type] += r.n
    }
  }
  return counts
}

export function removeAssets(ids: number[]): void {
  if (ids.length === 0) return
  const ph = ids.map(() => '?').join(',')
  const thumbs = getDb()
    .prepare(`SELECT thumb FROM assets WHERE id IN (${ph}) AND thumb IS NOT NULL AND thumb != ''`)
    .all(...ids) as { thumb: string }[]
  getDb().prepare(`DELETE FROM assets WHERE id IN (${ph})`).run(...ids)
  for (const t of thumbs) {
    const file = resolve(thumbsDir(), t.thumb)
    try {
      unlinkSync(file)
    } catch {
      // 缩略图文件不存在则忽略
    }
  }
  emit('library:changed', {})
}

// ---------- 标签 ----------

export function listTags(): Tag[] {
  return getDb()
    .prepare(
      `SELECT t.id, t.name, COUNT(at.asset_id) AS count
       FROM tags t LEFT JOIN asset_tags at ON at.tag_id = t.id
       GROUP BY t.id ORDER BY t.name COLLATE NOCASE`
    )
    .all() as Tag[]
}

export function createTag(name: string): Tag {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('标签名不能为空')
  getDb().prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').run(trimmed)
  const row = getDb().prepare('SELECT id FROM tags WHERE name = ?').get(trimmed) as { id: number }
  emit('library:changed', {})
  return { id: row.id, name: trimmed, count: 0 }
}

export function renameTag(id: number, name: string): void {
  getDb().prepare('UPDATE tags SET name = ? WHERE id = ?').run(name.trim(), id)
  emit('library:changed', {})
}

export function deleteTag(id: number): void {
  getDb().prepare('DELETE FROM tags WHERE id = ?').run(id)
  emit('library:changed', {})
}

export function addTagToAssets(tagId: number, assetIds: number[]): void {
  if (assetIds.length === 0) return
  const stmt = getDb().prepare('INSERT OR IGNORE INTO asset_tags (asset_id, tag_id) VALUES (?, ?)')
  const tx = getDb().transaction((ids: number[]) => {
    for (const id of ids) stmt.run(id, tagId)
  })
  tx(assetIds)
  emit('library:changed', { ids: assetIds })
}

export function removeTagFromAssets(tagId: number, assetIds: number[]): void {
  if (assetIds.length === 0) return
  const ph = assetIds.map(() => '?').join(',')
  getDb().prepare(`DELETE FROM asset_tags WHERE tag_id = ? AND asset_id IN (${ph})`).run(tagId, ...assetIds)
  emit('library:changed', { ids: assetIds })
}

// ---------- 虚拟分类夹 ----------

export function listFolders(): Folder[] {
  const rows = getDb()
    .prepare(
      `SELECT f.id, f.name, f.parent_id, COUNT(af.asset_id) AS count
       FROM folders f LEFT JOIN asset_folders af ON af.folder_id = f.id
       GROUP BY f.id ORDER BY f.name COLLATE NOCASE`
    )
    .all() as (Omit<Folder, 'parentId'> & { parent_id: number | null })[]
  return rows.map((r) => ({ id: r.id, name: r.name, parentId: r.parent_id, count: r.count }))
}

export function createFolder(name: string, parentId: number | null): Folder {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('分类夹名不能为空')
  const r = getDb().prepare('INSERT INTO folders (name, parent_id) VALUES (?, ?)').run(trimmed, parentId)
  emit('library:changed', {})
  return { id: Number(r.lastInsertRowid), name: trimmed, parentId, count: 0 }
}

export function renameFolder(id: number, name: string): void {
  getDb().prepare('UPDATE folders SET name = ? WHERE id = ?').run(name.trim(), id)
  emit('library:changed', {})
}

export function deleteFolder(id: number): void {
  getDb().prepare('DELETE FROM folders WHERE id = ?').run(id)
  emit('library:changed', {})
}

export function addAssetsToFolder(folderId: number, assetIds: number[]): void {
  if (assetIds.length === 0) return
  const stmt = getDb().prepare('INSERT OR IGNORE INTO asset_folders (asset_id, folder_id) VALUES (?, ?)')
  const tx = getDb().transaction((ids: number[]) => {
    for (const id of ids) stmt.run(id, folderId)
  })
  tx(assetIds)
  emit('library:changed', { ids: assetIds })
}

export function removeAssetsFromFolder(folderId: number, assetIds: number[]): void {
  if (assetIds.length === 0) return
  const ph = assetIds.map(() => '?').join(',')
  getDb()
    .prepare(`DELETE FROM asset_folders WHERE folder_id = ? AND asset_id IN (${ph})`)
    .run(folderId, ...assetIds)
  emit('library:changed', { ids: assetIds })
}
