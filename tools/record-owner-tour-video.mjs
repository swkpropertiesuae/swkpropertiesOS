import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { chromium } from 'playwright-core'

const REPO_DIR = 'C:/Users/Shahid/.gemini/antigravity/scratch/swkpropertiesOS'
const ARTIFACT_DIR = 'C:/Users/Shahid/.gemini/antigravity/brain/0ffbc651-4ce7-43d4-9703-d0e60c87a8c3'
const ASSETS_DIR = path.join(REPO_DIR, 'docs/handbook-assets')
const CHROME_EXE = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const PORT = 8796
const BASE_URL = `http://127.0.0.1:${PORT}`

const CHAPTERS = [
  { num: '01', title: 'Secure Sign-In Gate & Live Market Ticker', dept: 'Sign-In', route: '/login', auth: false },
  { num: '02', title: '12-Department All Apps Home Screen', dept: 'All Apps Hub', route: '/home', auth: true },
  { num: '03', title: 'Owner Executive Overview & 10-Step Execution Bar', dept: 'Dept 1 · Dashboards', route: '/dashboard', auth: true },
  { num: '04', title: 'Daily Operations — Company Operations Centre', dept: 'Dept 1 · Dashboards', route: '/enterprise/master-os', auth: true },
  { num: '05', title: 'Owner Delete Bin — Permanent Deletion Protection', dept: 'Dept 1 · Dashboards', route: '/recycle-bin', auth: true },
  { num: '06', title: 'Dubai Market Pulse — 24 Areas & Live DLD Feed', dept: 'Dept 1 · Dashboards', route: '/market', auth: true },
  { num: '07', title: 'Properties & Units — Approved Buildings & Villas', dept: 'Dept 2 · Properties', route: '/e/properties', auth: true },
  { num: '08', title: 'Listing Studio — Bayut, Dubizzle & Trakheesi Ads', dept: 'Dept 2 · Properties', route: '/listings', auth: true },
  { num: '09', title: 'CRM Leads — Scoped Broker Enquiries & Routing', dept: 'Dept 3 · CRM', route: '/e/leads', auth: true },
  { num: '10', title: 'Visual Deal Pipeline Board — Off-Plan, Secondary & Leasing', dept: 'Dept 3 · CRM & Sales', route: '/pipeline', auth: true },
  { num: '11', title: 'Sales & Mandates — Form A, Form F, NOC & DLD Transfer', dept: 'Dept 4 · Sales & Mandates', route: '/e/transactions', auth: true },
  { num: '12', title: 'Leasing & Management — Leases & Ejari Contracts', dept: 'Dept 5 · Leasing', route: '/e/leases', auth: true },
  { num: '13', title: 'PDC Cheque Vault — Post-Dated Rent Cheques & Maturity', dept: 'Dept 5 · Leasing', route: '/pdc', auth: true },
  { num: '14', title: 'Landlords — Owner Portfolios, Yields & Payout Statements', dept: 'Dept 6 · Landlords', route: '/owners', auth: true },
  { num: '15', title: 'Accounting — P&L, Balance Sheet, 50/50 Split & UAE 5% VAT', dept: 'Dept 7 · Accounting', route: '/finance/statements', auth: true },
  { num: '16', title: 'Compliance — RERA Centre, Trakheesi Permits & KYC/AML', dept: 'Dept 8 · Compliance', route: '/rera', auth: true },
  { num: '17', title: 'Employees — Broker Leaderboard, Visas & WPS Payroll', dept: 'Dept 9 · Employees', route: '/agents', auth: true },
  { num: '18', title: 'Field Service — SWK ONE Mobile App, QR & GPS Visits', dept: 'Dept 10 · Field Service', route: '/swk-one', auth: true },
  { num: '19', title: 'Documents — Instant 4% DLD, Mortgage, Yield & Split Calculators', dept: 'Dept 11 · Documents', route: '/toolkit', auth: true },
  { num: '20', title: 'Settings — Company Profile, Roles, Backups & Audit Trail', dept: 'Dept 12 · Settings', route: '/admin/settings', auth: true },
]

async function waitForServer(url, timeoutMs = 60000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/api/health`)
      if (res.ok) return
    } catch {}
    await new Promise(r => setTimeout(r, 600))
  }
  throw new Error('Server did not start in time')
}

async function showChapterBanner(page, ch) {
  await page.evaluate(({ num, title, dept }) => {
    const old = document.getElementById('swk-tour-banner')
    if (old) old.remove()
    const el = document.createElement('div')
    el.id = 'swk-tour-banner'
    el.style.cssText = [
      'position:fixed',
      'bottom:24px',
      'right:24px',
      'z-index:999999',
      'background:linear-gradient(135deg, rgba(7,17,32,0.96) 0%, rgba(19,37,68,0.96) 100%)',
      'border:1.5px solid #C8A24A',
      'border-radius:12px',
      'padding:14px 20px',
      'color:#F8F4EC',
      'font-family:"Plus Jakarta Sans","Segoe UI",sans-serif',
      'box-shadow:0 16px 40px rgba(0,0,0,0.45)',
      'max-width:460px',
      'pointer-events:none',
    ].join(';')
    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:5px;">
        <span style="background:#C8A24A;color:#071120;font-weight:800;font-size:11px;padding:3px 9px;border-radius:999px;letter-spacing:0.08em;">CHAPTER ${num} / 20</span>
        <span style="color:#E8C97A;font-size:11.5px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;">${dept}</span>
      </div>
      <div style="font-size:15px;font-weight:800;line-height:1.3;color:#FFFFFF;">${title}</div>
    `
    document.body.appendChild(el)
  }, ch)
}

async function main() {
  fs.mkdirSync(ASSETS_DIR, { recursive: true })
  const tmpVideoDir = path.join(ARTIFACT_DIR, 'scratch/tour-video-' + Date.now())
  const tmpDataDir = path.join(ARTIFACT_DIR, 'scratch/tour-data-' + Date.now())
  fs.mkdirSync(tmpVideoDir, { recursive: true })
  fs.mkdirSync(tmpDataDir, { recursive: true })

  console.log('1. Starting local SWK Properties OS server on port', PORT)
  const serverProc = spawn(process.execPath, ['dist/server/index.mjs'], {
    cwd: REPO_DIR,
    env: {
      ...process.env,
      NODE_ENV: 'development',
      PORT: String(PORT),
      HOST: '127.0.0.1',
      DATA_DIR: tmpDataDir,
      DATABASE_URL: '',
      REQUIRE_DATABASE_URL: 'false',
      DEMO_ENABLED: 'true',
      STARTER_DATA: 'true',
    },
    stdio: 'ignore',
  })

  try {
    await waitForServer(BASE_URL)
    console.log('2. Server healthy! Recording 20-chapter guided video tour...')
    const browser = await chromium.launch({ executablePath: CHROME_EXE, headless: true, args: ['--no-sandbox'] })
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      recordVideo: { dir: tmpVideoDir, size: { width: 1280, height: 720 } },
    })
    const page = await ctx.newPage()
    const video = page.video()

    // Chapter 01: Login
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' })
    await showChapterBanner(page, CHAPTERS[0])
    await page.waitForTimeout(1800)

    // Sign in to demo workspace
    const demo = await (await ctx.request.get(`${BASE_URL}/api/demo/status`)).json()
    await page.locator('input[type="email"]').fill(demo.email || 'demo@swkpropertiesuae.com')
    await page.locator('input[type="password"]').fill(demo.password || 'Demo@SWK2026')
    await page.waitForTimeout(500)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await page.waitForURL('**/home', { timeout: 25000 })

    // Chapters 02 .. 20
    for (let i = 1; i < CHAPTERS.length; i++) {
      const ch = CHAPTERS[i]
      if (i > 1) {
        await page.goto(`${BASE_URL}${ch.route}`, { waitUntil: 'networkidle' })
      }
      await showChapterBanner(page, ch)
      await page.waitForTimeout(1400)
      await page.evaluate(() => window.scrollBy({ top: 240, behavior: 'smooth' }))
      await page.waitForTimeout(900)
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
      await page.waitForTimeout(500)
      console.log(`  ✓ Recorded Chapter ${ch.num}: ${ch.title}`)
    }

    await ctx.close()
    await browser.close()

    const recordedPath = await video.path()
    const outRepoVideo = path.join(ASSETS_DIR, 'swk_os_complete_owner_tour.webm')
    const outArtifactVideo = path.join(ARTIFACT_DIR, 'SWK_Properties_OS_Complete_Owner_Tour.webm')
    fs.copyFileSync(recordedPath, outRepoVideo)
    fs.copyFileSync(recordedPath, outArtifactVideo)
    const sizeMb = (fs.statSync(outArtifactVideo).size / 1024 / 1024).toFixed(2)
    console.log(`3. Video tour saved (${sizeMb} MB):`)
    console.log(`   - Repo:     ${outRepoVideo}`)
    console.log(`   - Artifact: ${outArtifactVideo}`)
  } finally {
    serverProc.kill()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
