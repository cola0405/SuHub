import { protocol } from 'electron'
import { createReadStream, existsSync } from 'fs'
import { stat } from 'fs/promises'
import { extname, join } from 'path'
import { Readable } from 'stream'
import { getDb, thumbsDir } from './db'

export function registerMediaScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'media',
      privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
    }
  ])
}

export function registerMediaProtocol(): void {
  protocol.handle('media', handleMediaRequest)
}

const MIME: Record<string, string> = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  avi: 'video/x-msvideo',
  wmv: 'video/x-ms-wmv',
  flv: 'video/x-flv',
  ts: 'video/mp2t',
  m2ts: 'video/mp2t',
  mpg: 'video/mpeg',
  mpeg: 'video/mpeg',
  '3gp': 'video/3gpp',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  avif: 'image/avif',
  ico: 'image/x-icon',
  tiff: 'image/tiff',
  tif: 'image/tiff',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  flac: 'audio/flac',
  ogg: 'audio/ogg',
  wma: 'audio/x-ms-wma',
  aiff: 'audio/aiff',
  aif: 'audio/aiff',
  opus: 'audio/opus'
}

function mimeOf(filePath: string): string {
  return MIME[extname(filePath).slice(1).toLowerCase()] ?? 'application/octet-stream'
}

function notFound(): Response {
  return new Response('not found', { status: 404 })
}

async function handleMediaRequest(req: Request): Promise<Response> {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response(null, { status: 405 })
  }
  const url = new URL(req.url)
  let filePath: string | null = null
  let immutable = false

  if (url.host === 'thumb') {
    const name = url.pathname.replace(/^\/+/, '')
    if (!/^[a-f0-9]{32}\.jpg$/.test(name)) return notFound()
    filePath = join(thumbsDir(), name)
    immutable = true
  } else if (url.host === 'asset') {
    const id = Number(url.pathname.replace(/^\/+/, ''))
    if (!Number.isInteger(id) || id <= 0) return notFound()
    const row = getDb().prepare('SELECT path FROM assets WHERE id = ?').get(id) as
      | { path: string }
      | undefined
    if (!row) return notFound()
    filePath = row.path
  } else {
    return notFound()
  }

  if (!filePath || !existsSync(filePath)) return notFound()

  const info = await stat(filePath)
  if (!info.isFile()) return notFound()

  const headers = new Headers({
    'content-type': mimeOf(filePath),
    'accept-ranges': 'bytes',
    'cache-control': immutable
      ? 'public, max-age=31536000, immutable'
      : 'no-store'
  })

  const range = req.headers.get('range')
  const match = range ? /bytes=(\d*)-(\d*)/.exec(range) : null

  if (match) {
    const start = match[1] ? Number(match[1]) : 0
    const end = match[2] ? Math.min(Number(match[2]), info.size - 1) : info.size - 1
    if (Number.isNaN(start) || start >= info.size || start > end) {
      return new Response(null, {
        status: 416,
        headers: { 'content-range': `bytes */${info.size}` }
      })
    }
    headers.set('content-range', `bytes ${start}-${end}/${info.size}`)
    headers.set('content-length', String(end - start + 1))
    if (req.method === 'HEAD') return new Response(null, { status: 206, headers })
    const stream = Readable.toWeb(
      createReadStream(filePath, { start, end })
    ) as unknown as ReadableStream
    return new Response(stream, { status: 206, headers })
  }

  headers.set('content-length', String(info.size))
  if (req.method === 'HEAD') return new Response(null, { status: 200, headers })
  const stream = Readable.toWeb(createReadStream(filePath)) as unknown as ReadableStream
  return new Response(stream, { status: 200, headers })
}
