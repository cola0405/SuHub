const fs = require('fs')

const BASE = process.argv[2] ?? 'http://127.0.0.1:9229'
const OUT = process.argv[3] ?? 'docs/screenshot.png'

async function main() {
  const list = await (await fetch(`${BASE}/json`)).json()
  const page = list.find((t) => t.type === 'page')
  if (!page) throw new Error('no page target')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((r) => (ws.onopen = r))

  let nextId = 1
  const pending = new Map()
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data)
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m)
      pending.delete(m.id)
    }
  })
  const call = (method, params = {}) =>
    new Promise((resolve) => {
      const id = nextId++
      pending.set(id, resolve)
      ws.send(JSON.stringify({ id, method, params }))
    })

  const evalJs = (expr) =>
    call('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }).then(
      (m) => m.result?.result?.value
    )

  await evalJs(
    `window.__store_setView__ ?? (() => {
      const ev = new KeyboardEvent('keydown', {key: 'Escape', bubbles: true})
      window.dispatchEvent(ev)
      return true
    })()`
  )
  await new Promise((r) => setTimeout(r, 600))

  const state = await evalJs(`JSON.stringify({
    title: document.title,
    cards: document.querySelectorAll('.card').length,
    empty: !!document.querySelector('.empty'),
    previewOpen: !!document.querySelector('.pv-mask')
  })`)
  console.log('STATE:', state)

  const shot = await call('Page.captureScreenshot', { format: 'png' })
  if (!shot.result?.data) throw new Error('capture failed: ' + JSON.stringify(shot).slice(0, 200))
  fs.mkdirSync(require('path').dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, Buffer.from(shot.result.data, 'base64'))
  const kb = Math.round(fs.statSync(OUT).size / 1024)
  console.log('SAVED:', OUT, kb + ' KB')
  ws.close()
  process.exit(0)
}

main().catch((e) => {
  console.error('ERR', e.message)
  process.exit(1)
})
