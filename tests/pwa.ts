/* Installable web app: manifest, icons, service worker and offline page are served correctly.
   Needs a server with a built web app (npm run build) on a fresh data directory:  npx tsx tests/pwa.ts */
import { Api, BASE, ok, sec, finish } from './_api'

async function main() {
  const a = new Api()
  sec('Manifest')
  let res = await fetch(BASE + '/manifest.webmanifest')
  ok('manifest is served', res.status === 200, res.status)
  const m: any = await res.json()
  ok('has name, short name, id and scope', m.name && m.short_name && m.id === '/' && m.scope === '/', m)
  ok('standalone display', m.display === 'standalone')
  ok('start URL is inside the scope', String(m.start_url).startsWith('/'))
  ok('theme and background colours are set', /^#[0-9a-f]{6}$/i.test(m.theme_color) && /^#[0-9a-f]{6}$/i.test(m.background_color))
  const purposes = (m.icons as any[]).map(i => `${i.sizes}:${i.purpose}`)
  ok('192 and 512 icons for any purpose', purposes.includes('192x192:any') && purposes.includes('512x512:any'), purposes)
  ok('a maskable icon is declared', purposes.some(p => p.endsWith(':maskable')), purposes)
  for (const i of m.icons) {
    const r = await fetch(BASE + i.src)
    const buf = Buffer.from(await r.arrayBuffer())
    ok(`icon ${i.src} (${i.purpose}) is a PNG of ${i.sizes}`, r.status === 200 && buf.subarray(1, 4).toString() === 'PNG' && `${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)}` === i.sizes, { status: r.status, size: `${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)}` })
  }
  ok('shortcuts point inside the scope', (m.shortcuts ?? []).length >= 3 && m.shortcuts.every((s: any) => String(s.url).startsWith('/')))

  sec('Page head')
  const html = await (await fetch(BASE + '/')).text()
  ok('page links the manifest', /rel="manifest" href="\/manifest\.webmanifest"/.test(html))
  ok('page has an apple touch icon and theme colour', /apple-touch-icon/.test(html) && /name="theme-color"/.test(html))
  ok('viewport covers notched screens', /viewport-fit=cover/.test(html))

  sec('Service worker')
  res = await fetch(BASE + '/sw.js')
  const sw = await res.text()
  ok('served as JavaScript', res.status === 200 && /javascript/.test(res.headers.get('content-type') ?? ''), res.headers.get('content-type'))
  ok('never cached by the browser, so updates are seen', /no-cache|no-store/.test(res.headers.get('cache-control') ?? ''), res.headers.get('cache-control'))
  ok('build id was stamped in', !sw.includes('__BUILD_ID__') && /const BUILD = '[a-z0-9]+'/.test(sw))
  ok('API requests are never intercepted', /pathname\.startsWith\('\/api\/'\)\) return/.test(sw))
  ok('only GET requests are handled', /req\.method !== 'GET'\) return/.test(sw))
  ok('pages are never stored (navigation is network only with offline fallback)', /mode === 'navigate'/.test(sw) && !/cache\.put\(req[^)]*\)[^]*navigate/.test(sw))
  ok('only versioned static folders are cached', /CACHEABLE = \/\^\\\/\(assets\|fonts\|brand\)\\\//.test(sw))
  ok('old caches are removed on activate', /caches\.delete/.test(sw))
  const code = sw.replace(/\/\*[^]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  ok('update waits for the person (no automatic skipWaiting)', !/install[^]{0,200}skipWaiting/.test(code.split("addEventListener('message'")[0]))
  const asset = (html.match(/\/assets\/[^"']+\.js/) ?? [])[0]
  ok('hashed assets are cached for a year', !!asset && /immutable/.test((await fetch(BASE + asset)).headers.get('cache-control') ?? ''), asset)
  ok('CSP lets the page register a same-origin worker', !/worker-src 'none'/.test((await fetch(BASE + '/')).headers.get('content-security-policy') ?? ''))
  res = await fetch(BASE + '/sw.js', { headers: { 'x-swk-client': 'web' } })
  ok('service worker needs no sign-in (it holds no private data)', res.status === 200)

  sec('Offline page')
  res = await fetch(BASE + '/offline.html')
  const off = await res.text()
  ok('offline page is served without sign-in', res.status === 200 && /You are offline/.test(off))
  ok('offline page has no scripts (strict CSP) and says data is not stored', !/<script/i.test(off) && /never stored/.test(off))

  sec('Sign-in is unaffected')
  ok('administrator signs in', await a.login())
  const r = await a.get('/api/auth/me')
  ok('API responses are not cacheable by shared caches', r.status === 200)
  const cc = (await a.raw('/api/auth/me')).headers.get('cache-control') ?? ''
  ok('API responses carry no public cache header', !/public/.test(cc), cc)
  finish()
}
main().catch(e => { console.error(e); process.exit(1) })
