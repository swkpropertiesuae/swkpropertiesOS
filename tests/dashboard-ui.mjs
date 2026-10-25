import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn, execFileSync } from 'node:child_process'
import { chromium } from 'playwright-core'

const data = fs.mkdtempSync(path.join(os.tmpdir(), 'digitalburj-ui-'))
const server = spawn(process.execPath, ['dist/server/index.mjs'], { env: { ...process.env, DATA_DIR: data, DATABASE_URL: '', REQUIRE_DATABASE_URL: 'false', DEMO_ENABLED: 'true', PORT: '8088', HOST: '127.0.0.1' }, stdio: ['ignore', 'pipe', 'pipe'] })
let logs = ''; server.stdout.on('data', b => { logs += b }); server.stderr.on('data', b => { logs += b })
const base = 'http://127.0.0.1:8088', out = '.impeccable/review'
fs.mkdirSync(out, { recursive: true })
let browser
try {
  let online = false
  for (let i = 0; i < 120; i++) { try { if ((await fetch(base + '/api/health')).ok) { online = true; break } } catch {} await new Promise(r => setTimeout(r, 500)) }
  assert.ok(online, logs)
  const executablePath = process.env.CHROME_PATH || execFileSync('bash', ['-c', 'command -v google-chrome || command -v chromium'], { encoding: 'utf8' }).trim()
  browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
  const page = await context.newPage(), errors = []
  page.on('pageerror', e => errors.push(e.message))
  const demo = await (await context.request.get(base + '/api/demo/status')).json()
  await page.goto(base + '/login')
  await page.locator('input[type="email"]').fill(demo.email)
  await page.locator('input[type="password"]').fill(demo.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.waitForURL('**/home')
  await page.getByRole('heading', { name: /Good (morning|afternoon|evening)/ }).waitFor()
  assert.equal(await page.locator('.swk-side').count(), 0, 'no sidebar')
  const tiles = page.locator('.swk-app-tile')
  await tiles.first().waitFor()
  assert.ok(await tiles.count() >= 5, 'launcher shows the permitted apps')
  const capture = async name => { await page.screenshot({ path: `${out}/${name}.png` }) }
  await capture('launcher-desktop')
  // Search narrows apps and lists matching features; Enter opens the first match.
  await page.getByLabel('Search apps and features').fill('lease')
  await page.getByRole('link', { name: /Leases & Ejari/ }).waitFor()
  await page.getByLabel('Search apps and features').press('Enter')
  await page.waitForURL('**/e/leases')
  // The app's pages replace the sidebar as a strip under the top bar.
  const sub = page.getByRole('navigation', { name: /Leasing & management pages/ })
  await sub.waitFor()
  await sub.getByRole('link', { name: 'Rent Schedules' }).click()
  await page.waitForURL('**/e/rent_schedules')
  await capture('app-desktop')
  // Apps button returns to the launcher, which offers recently opened pages.
  await page.getByRole('link', { name: 'All apps', exact: true }).first().click()
  await page.waitForURL('**/home')
  await page.getByRole('link', { name: 'Rent Schedules' }).first().waitFor()
  await tiles.filter({ hasText: 'Sales & mandates' }).click()
  await page.waitForURL('**/e/mandates')
  // Mobile: tiles fit the viewport and the app strip stays reachable.
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto(base + '/home')
  await tiles.first().waitFor(); await page.waitForTimeout(300)
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'mobile launcher fits viewport')
  await capture('launcher-mobile')
  await tiles.nth(3).click()
  await page.getByRole('navigation', { name: /pages$/ }).waitFor()
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'mobile app page fits viewport')
  assert.deepEqual(errors.filter(e => !/401/.test(e)), [])
  console.log('PASS: sign-in lands on the app launcher, search, app sub-navigation, recents, mobile layout')
} finally { await browser?.close(); server.kill('SIGTERM'); fs.rmSync(data, { recursive: true, force: true }) }
