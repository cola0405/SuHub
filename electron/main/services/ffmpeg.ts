import { spawn } from 'child_process'
import { randomBytes } from 'crypto'
import { app } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'
import ffmpegStatic from 'ffmpeg-static'
import ffprobeStatic from 'ffprobe-static'
import { thumbsDir } from '../db'
import type { AssetType } from '../../shared/types'

let ffmpegPath: string
let ffprobePath: string

export function initFfmpeg(): void {
  if (app.isPackaged) {
    ffmpegPath = join(process.resourcesPath, 'bin', 'ffmpeg.exe')
    ffprobePath = join(process.resourcesPath, 'bin', 'ffprobe.exe')
  } else {
    ffmpegPath = ffmpegStatic as unknown as string
    ffprobePath = ffprobeStatic.path
  }
  if (!existsSync(ffmpegPath)) throw new Error(`ffmpeg 不存在: ${ffmpegPath}`)
  if (!existsSync(ffprobePath)) throw new Error(`ffprobe 不存在: ${ffprobePath}`)
}

export function ffmpegBin(): string {
  return ffmpegPath
}

function run(bin: string, args: string[], timeoutMs = 60000): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { windowsHide: true })
    let out = ''
    let err = ''
    const timer = setTimeout(() => {
      p.kill()
      reject(new Error(`${bin} 超时`))
    }, timeoutMs)
    p.stdout.on('data', (d) => (out += d))
    p.stderr.on('data', (d) => (err += d))
    p.on('error', (e) => {
      clearTimeout(timer)
      reject(e)
    })
    p.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) resolve(out)
      else reject(new Error(err || `${bin} 退出码 ${code}`))
    })
  })
}

export interface ProbeResult {
  duration: number | null
  width: number | null
  height: number | null
}

interface FfStream {
  codec_type?: string
  width?: number
  height?: number
  duration?: string
}

export async function probe(filePath: string): Promise<ProbeResult> {
  const out = await run(ffprobePath, [
    '-v', 'error',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    filePath
  ])
  const json = JSON.parse(out) as { streams?: FfStream[]; format?: { duration?: string } }
  const streams = json.streams ?? []
  const video = streams.find((s) => s.codec_type === 'video')
  const audio = streams.find((s) => s.codec_type === 'audio')
  const duration =
    Number(json.format?.duration) ||
    Number(video?.duration) ||
    Number(audio?.duration) ||
    null
  return {
    duration,
    width: video ? Number(video.width) || null : null,
    height: video ? Number(video.height) || null : null
  }
}

export async function makeThumbnail(filePath: string, type: AssetType): Promise<string> {
  const name = randomBytes(16).toString('hex') + '.jpg'
  const outFile = join(thumbsDir(), name)
  const base = ['-y', '-i', filePath, '-frames:v', '1', '-vf', "scale='min(480,iw)':-2", '-q:v', '4', outFile]
  if (type === 'video') {
    try {
      await run(ffmpegPath, ['-ss', '1', ...base])
    } catch {
      await run(ffmpegPath, base)
    }
  } else {
    await run(ffmpegPath, base)
  }
  return name
}
