import { spawn } from 'child_process'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { ffmpegBin } from './services/ffmpeg'
import * as library from './services/library'
import type { Asset } from '../shared/types'

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function gen(args: string[]): Promise<void> {
  const bin = ffmpegBin()
  return new Promise((resolve, reject) => {
    const p = spawn(bin, ['-y', ...args], { windowsHide: true })
    let err = ''
    p.stderr.on('data', (d) => (err += d))
    p.on('error', reject)
    p.on('close', (c) => (c === 0 ? resolve() : reject(new Error(err))))
  })
}

export async function runSmokeTest(): Promise<number> {
  const errors: string[] = []
  const dir = mkdtempSync(join(tmpdir(), 'sucai-smoke-media-'))
  console.log('[smoke] 测试素材目录:', dir)

  try {
    await gen([
      '-f', 'lavfi', '-i', 'testsrc=duration=2:size=640x360:rate=15',
      '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest',
      join(dir, 'video.mp4')
    ])
    await gen(['-f', 'lavfi', '-i', 'color=c=0x3a7afe:s=800x600:d=1', '-frames:v', '1', join(dir, 'image.png')])
    await gen(['-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', join(dir, 'audio.wav')])
    console.log('[smoke] 已生成 3 个测试素材')
  } catch (e) {
    console.error('[smoke] 生成测试素材失败:', e)
    return 1
  }

  const added = library.importPaths([dir], true)
  console.log(`[smoke] 导入完成，新增 ${added} 条（期望 3）`)
  if (added !== 3) errors.push(`导入数量 ${added} != 3`)

  const deadline = Date.now() + 120000
  let assets: Asset[] = []
  while (Date.now() < deadline) {
    assets = library.listAssets({ view: 'all' })
    const v = assets.find((a) => a.type === 'video')
    const i = assets.find((a) => a.type === 'image')
    const a = assets.find((x) => x.type === 'audio')
    const ready = v?.thumb && v.duration && v.width && i?.thumb && a?.duration
    if (ready) break
    await sleep(500)
  }

  const video = assets.find((a) => a.type === 'video')
  const image = assets.find((a) => a.type === 'image')
  const audio = assets.find((a) => a.type === 'audio')

  const check = (label: string, cond: boolean, detail: string): void => {
    console.log(`[smoke] ${cond ? 'PASS' : 'FAIL'} ${label} ${detail}`)
    if (!cond) errors.push(label)
  }

  if (video) {
    check('视频元数据', video.duration !== null && video.duration >= 1.5, `duration=${video.duration}`)
    check('视频分辨率', video.width === 640 && video.height === 360, `${video.width}x${video.height}`)
    check('视频缩略图', video.thumb !== null, `thumb=${video.thumb ?? 'null'}`)
  } else errors.push('视频记录缺失')

  if (image) {
    check('图片元数据', image.width === 800 && image.height === 600, `${image.width}x${image.height}`)
    check('图片缩略图', image.thumb !== null, `thumb=${image.thumb ?? 'null'}`)
  } else errors.push('图片记录缺失')

  if (audio) {
    check('音频元数据', audio.duration !== null && audio.duration >= 1.5, `duration=${audio.duration}`)
  } else errors.push('音频记录缺失')

  // 标签/分类夹链路
  const tag = library.createTag('smoke-tag')
  library.addTagToAssets(tag.id, assets.map((a) => a.id))
  const folder = library.createFolder('smoke-folder', null)
  library.addAssetsToFolder(folder.id, assets.map((a) => a.id))
  const relisted = library.listAssets({ view: 'all' })
  const tagged = relisted.filter((a) => a.tags.some((t) => t.id === tag.id)).length
  const foldered = relisted.filter((a) => a.folderIds.includes(folder.id)).length
  check('标签关联', tagged === 3, `${tagged}/3`)
  check('分类夹关联', foldered === 3, `${foldered}/3`)
  const searched = library.listAssets({ view: 'all', search: 'video' })
  check('搜索', searched.length === 1 && searched[0].type === 'video', `hits=${searched.length}`)

  library.removeAssets(assets.map((a) => a.id))
  library.deleteTag(tag.id)
  library.deleteFolder(folder.id)
  const after = library.listAssets({ view: 'all' })
  check('删除记录', after.length === 0, `剩余 ${after.length}`)

  rmSync(dir, { recursive: true, force: true })

  console.log(errors.length === 0 ? '[smoke] 全部通过 ✓' : `[smoke] 失败 ${errors.length} 项: ${errors.join(', ')}`)
  return errors.length === 0 ? 0 : 1
}
