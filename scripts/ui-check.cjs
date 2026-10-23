const BASE = process.argv[2] ?? 'http://127.0.0.1:9223'

async function main() {
  const list = await (await fetch(`${BASE}/json`)).json()
  const page = list.find((t) => t.type === 'page')
  if (!page) throw new Error('no page target')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((r) => (ws.onopen = r))

  let nextId = 1
  const evalJs = (expr) =>
    new Promise((resolve, reject) => {
      const id = nextId++
      const onmsg = (ev) => {
        const m = JSON.parse(ev.data)
        if (m.id === id) {
          ws.removeEventListener('message', onmsg)
          if (m.result?.exceptionDetails) {
            reject(new Error(m.result.exceptionDetails.exception?.description ?? 'eval error'))
          } else {
            resolve(m.result?.result?.value)
          }
        }
      }
      ws.addEventListener('message', onmsg)
      ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true, awaitPromise: true } }))
    })

  await evalJs('1')
  const apiType = await evalJs('typeof window.api')
  console.log('api type:', apiType)
  const importType = await evalJs('typeof window.api.importPaths')
  console.log('importPaths type:', importType)

  const cmd = process.argv[3]
  if (cmd === 'state') {
    const s = await evalJs(`JSON.stringify({
      title: document.title,
      cards: document.querySelectorAll('.card').length,
      imgs: Array.from(document.querySelectorAll('.card img')).map(im => ({ w: im.naturalWidth, ok: im.complete && im.naturalWidth > 0 })),
      badges: Array.from(document.querySelectorAll('.duration')).map(b => b.textContent),
      empty: !!document.querySelector('.empty')
    })`)
    console.log('PAGE_STATE:', s)
  } else if (cmd === 'import') {
    const dir = process.argv[4]
    const r = await evalJs(`window.api.importPaths(["${dir}"], true).then(r => JSON.stringify(r))`)
    console.log('IMPORT:', r)
    for (let i = 0; i < 24; i++) {
      await new Promise((rr) => setTimeout(rr, 500))
      const s = JSON.parse(
        await evalJs(`JSON.stringify({
          cards: document.querySelectorAll('.card').length,
          imgs: Array.from(document.querySelectorAll('.card img')).map(im => ({ w: im.naturalWidth, ok: im.complete && im.naturalWidth > 0 })),
          badges: Array.from(document.querySelectorAll('.duration')).map(b => b.textContent)
        })`)
      )
      console.log(`tick ${i}:`, JSON.stringify(s))
      if (s.cards >= 2 && s.imgs.length >= 1 && s.imgs.every((x) => x.ok)) {
        console.log('UI_VERIFY_OK')
        break
      }
    }
  } else if (cmd === 'hover') {
    await evalJs(`document.querySelector('.card').dispatchEvent(new MouseEvent('mouseenter', {bubbles: false}))`)
    await new Promise((r) => setTimeout(r, 1400))
    const during = await evalJs(`(() => {
      const v = document.querySelector('.hover-video')
      return JSON.stringify({ exists: !!v, paused: v ? v.paused : null, t: v ? +v.currentTime.toFixed(2) : null, w: v ? v.videoWidth : null })
    })()`)
    console.log('HOVER_DURING:', during)
    await evalJs(`document.querySelector('.card').dispatchEvent(new MouseEvent('mouseleave', {bubbles: false}))`)
    await new Promise((r) => setTimeout(r, 200))
    const after = await evalJs(`JSON.stringify({ exists: !!document.querySelector('.hover-video') })`)
    console.log('HOVER_AFTER_LEAVE:', after)
  } else if (cmd === 'leave') {
    const before = await evalJs(`document.querySelectorAll('.hover-video').length`)
    const fired = await evalJs(`(() => {
      window.__leaveFired = false
      const card = document.querySelector('.card')
      card.addEventListener('mouseleave', () => { window.__leaveFired = true })
      card.dispatchEvent(new MouseEvent('mouseleave'))
      return 'dispatched'
    })()`)
    await new Promise((r) => setTimeout(r, 300))
    const after = await evalJs(`JSON.stringify({ fired: window.__leaveFired, count: document.querySelectorAll('.hover-video').length })`)
    console.log('before:', before, fired, 'after:', after)
  } else if (cmd === 'brand') {
    const s = JSON.parse(
      await evalJs(`JSON.stringify({
        title: document.title,
        brand: (() => { const b = document.querySelector('.brand'); return b ? b.textContent.trim() : null })(),
        logo: (() => { const i = document.querySelector('.brand-logo'); return i ? (i.complete && i.naturalWidth > 0 ? 'loaded:' + i.naturalWidth : 'broken') : 'missing' })(),
        cards: document.querySelectorAll('.card').length
      })`)
    )
    console.log('BRAND:', JSON.stringify(s))
  } else if (cmd === 'thumbs') {
    const info = JSON.parse(
      await evalJs(`JSON.stringify({
        srcs: Array.from(document.querySelectorAll('.card img')).map(i => i.src),
        ready: Array.from(document.querySelectorAll('.card img')).map(i => i.complete + '/' + i.naturalWidth)
      })`)
    )
    console.log('SRCS:', JSON.stringify(info.srcs))
    console.log('READY:', JSON.stringify(info.ready))
    for (const src of info.srcs) {
      const r = await evalJs(`(async () => {
        try {
          const r = await fetch("${src}")
          const buf = await r.arrayBuffer()
          return JSON.stringify({ status: r.status, type: r.headers.get('content-type'), bytes: buf.byteLength })
        } catch (e) { return 'FETCH_ERR: ' + e.message }
      })()`)
      console.log('FETCH', src.slice(0, 60), '->', r)
    }
  } else if (cmd === 'preview') {
    await evalJs(`document.querySelectorAll('.card > div')[0].dispatchEvent(new MouseEvent('dblclick', {bubbles: true}))`)
    await new Promise((r) => setTimeout(r, 2500))
    const s = await evalJs(`JSON.stringify({
      modal: !!document.querySelector('.pv-mask'),
      video: (() => { const v = document.querySelector('.pv-video'); return v ? JSON.stringify({vw: v.videoWidth, ready: v.readyState, paused: v.paused, dur: Math.round(v.duration)}) : null })(),
      image: !!document.querySelector('.pv-image img'),
      tagsRow: !!document.querySelector('.pv-tags')
    })`)
    console.log('PREVIEW:', s)
    await evalJs(`window.api.showInFolder && 1`)
  } else if (cmd === 'cleanup') {
    const ids = JSON.parse(
      await evalJs(`window.api.listAssets({view:'all'}).then(a => JSON.stringify(a.map(x => x.id)))`)
    )
    await evalJs(`window.api.removeAssets(${JSON.stringify(ids)}).then(() => 1)`)
    console.log('CLEANED', ids.length)
  }
  ws.close()
  process.exit(0)
}

main().catch((e) => {
  console.error('ERR', e.message)
  process.exit(1)
})
