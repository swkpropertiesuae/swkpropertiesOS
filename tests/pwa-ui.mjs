import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn, execFileSync } from 'node:child_process'
import { chromium } from 'playwright-core'
/* Installable web app in a real browser: the service worker registers, the app is installable,
   the offline page shows without a network, and private API data is never stored.  Needs: npm run build && npm run build:api */
const base = 'http://127.0.0.1:8092', data = fs.mkdtempSync(path.join(os.tmpdir(), 'swk-pwa-ui-'))
const server = spawn(process.execPath, ['dist/server/index.mjs'], { env: { ...process.env, DATA_DIR: data, DATABASE_URL: '', DEMO_ENABLED: 'true', PORT: '8092', HOST: '127.0.0.1', NODE_ENV: 'development', COOKIE_SECURE: 'false' }, stdio: ['ignore', 'pipe', 'pipe'] })
let logs = '', browser; server.stdout.on('data', b => logs += b); server.stderr.on('data', b => logs += b)
try {
  let ready = false
  for (let i = 0; i < 90; i++) { try { if ((await fetch(base + '/api/health')).ok) { ready = true; break } } catch {} await new Promise(r => setTimeout(r, 500)) }
  assert.ok(ready, logs)
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || execFileSync('bash', ['-c', 'command -v google-chrome || command -v chromium'], { encoding: 'utf8' }).trim(), headless: true, args: ['--no-sandbox'] })
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' }), page = await context.newPage(), errors = []
  page.on('pageerror', e => errors.push(e.message))
  const demo = await (await context.request.get(base + '/api/demo/status')).json()
  await page.goto(base + '/login'); await page.locator('input[type="email"]').fill(demo.email); await page.locator('input[type="password"]').fill(demo.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click(); await page.waitForURL('**/home')

  // 1. service worker registers and takes control after a reload
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload(); await page.waitForLoadState('load')
  assert.ok(await page.evaluate(() => !!navigator.serviceWorker.controller), 'service worker controls the page after reload')
  console.log('  ✓ service worker registered and in control')

  // 2. the browser considers the app installable
  const cdp = await context.newCDPSession(page)
  const inst = await cdp.send('Page.getInstallabilityErrors')
  const real = inst.installabilityErrors.filter(e => e.errorId !== 'in-incognito') // the test browser context is incognito
  assert.deepEqual(real, [], JSON.stringify(real))
  console.log('  ✓ no installability errors reported by the browser')

  // 3. browse a few data pages, then confirm no private data was stored
  for (const p of ['/e/leads', '/calendar', '/e/leases']) { await page.goto(base + p); await page.waitForLoadState('networkidle') }
  const cached = await page.evaluate(async () => { const out = []; for (const k of await caches.keys()) for (const r of await (await caches.open(k)).keys()) out.push(new URL(r.url).pathname); return out })
  assert.ok(cached.length > 0, 'something static was cached')
  assert.ok(!cached.some(u => u.startsWith('/api/')), 'API responses must never be cached: ' + cached.filter(u => u.startsWith('/api/')).join(','))
  assert.ok(!cached.some(u => !/^\/(assets|fonts|brand)\//.test(u) && !['/offline.html', '/manifest.webmanifest', '/app-icon-192.png', '/app-icon-512.png', '/favicon/apple-touch-icon.png'].includes(u)), 'unexpected cached entries: ' + cached.join(','))
  console.log(`  ✓ ${cached.length} static files cached, no API data and no pages`)

  // 4. offline: pages show the offline page, API calls fail (not served from a cache)
  await context.setOffline(true)
  await page.goto(base + '/e/leases').catch(() => {})
  await page.getByRole('heading', { name: 'You are offline' }).waitFor({ timeout: 10000 })
  console.log('  ✓ offline navigation shows the offline page')
  const apiOffline = await page.evaluate(async () => { try { const r = await fetch('/api/e/leases?pageSize=1', { credentials: 'same-origin' }); return 'served ' + r.status } catch { return 'failed' } })
  assert.equal(apiOffline, 'failed', 'API must fail offline, not be served from a cache')
  console.log('  ✓ API request fails offline instead of returning stored data')
  await context.setOffline(false)
  await page.goto(base + '/e/leases'); await page.waitForLoadState('networkidle')
  assert.ok(!(await page.getByRole('heading', { name: 'You are offline' }).count()), 'back online shows the app again')
  console.log('  ✓ back online the app loads normally')

  // 5. install item is hidden when the browser offers no install prompt, and the app has no console errors
  assert.deepEqual(errors, [], errors.join('\n'))
  console.log('  ✓ no page errors')
  console.log('\nPWA UI checks passed')
} catch (e) { console.error(e); console.error(logs.slice(-1500)); process.exitCode = 1 }
finally { await browser?.close(); server.kill() }
