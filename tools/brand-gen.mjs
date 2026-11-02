/**
 * SWK Properties Brand Asset Pipeline for SWK OS & SWK ONE.
 *
 * Uses the official studio brand renders in assets-src/:
 *   - SWK_Studio_Logo_UAE.jpg            Studio master: 3D Metallic Gold + UAE Monogram, connected SWK, UAE PRO PER TIES & tagline
 *   - SWK_Studio_Logo_Gold.jpg           Studio master: Pure 3D Brushed Metallic Gold Monogram, connected SWK, Gold PROPERTIES & tagline
 *   - SWK_favicon.ico                    Multi-size favicon
 *
 * Generates:
 *   - public/brand/swk-logo-ink.png      Transparent SWK Properties wordmark (UAE PRO PER TIES, for light headers & print)
 *   - public/brand/swk-logo-dark.png     Transparent SWK Properties wordmark (UAE PRO PER TIES, for light surfaces)
 *   - public/brand/swk-logo-white.png    Transparent SWK Properties wordmark (Pure Metallic Gold, for charcoal & dark surfaces)
 *   - public/brand/swk-logo.png          Master transparent wordmark
 *   - public/brand/swk-mark.png          512x512 Architectural Tower Monogram (with padding)
 *   - public/brand/swk-signage-logo.png  Full Studio Lockup (UAE colours + Brushed Metallic Gold + "From arrival to address.")
 *   - public/brand/swk-signage-icon.png  Full Studio Lockup (Pure Brushed Metallic Gold + "From arrival to address.")
 *   - public/favicon/favicon-<n>.png     16..512 favicons with entire architectural mark visible & sufficient padding
 *   - public/favicon/apple-touch-icon.png, favicon.ico, favicon.svg
 *   - public/app-icon-192.png / 512.png  PWA & Android icons
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { PNG } = require('pngjs')
const { chromium } = require('playwright-core')

const root = path.resolve(import.meta.dirname, '..')
const brandDir = path.join(root, 'public', 'brand')
const favDir = path.join(root, 'public', 'favicon')
const srcUaeJpg = path.join(root, 'assets-src', 'SWK_Studio_Logo_UAE.jpg')
const srcGoldJpg = path.join(root, 'assets-src', 'SWK_Studio_Logo_Gold.jpg')
const srcIco = path.join(root, 'assets-src', 'SWK_favicon.ico')

fs.mkdirSync(brandDir, { recursive: true })
fs.mkdirSync(favDir, { recursive: true })

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)

/** High-precision area-averaged + bilinear supersampled resize with premultiplied alpha. */
function resizeSmooth(src, w, h) {
  if (src.width === w && src.height === h) return src
  const out = new PNG({ width: w, height: h })
  const scaleX = src.width / w
  const scaleY = src.height / h

  const sampleBilinear = (fx, fy) => {
    const x0 = clamp(Math.floor(fx), 0, src.width - 1)
    const y0 = clamp(Math.floor(fy), 0, src.height - 1)
    const x1 = clamp(x0 + 1, 0, src.width - 1)
    const y1 = clamp(y0 + 1, 0, src.height - 1)
    const dx = fx - Math.floor(fx)
    const dy = fy - Math.floor(fy)
    const getPM = (px, py) => {
      const idx = (py * src.width + px) * 4
      const a = src.data[idx + 3] / 255
      return [src.data[idx] * a, src.data[idx + 1] * a, src.data[idx + 2] * a, a]
    }
    const p00 = getPM(x0, y0), p10 = getPM(x1, y0), p01 = getPM(x0, y1), p11 = getPM(x1, y1)
    const res = [0, 0, 0, 0]
    for (let c = 0; c < 4; c++) {
      const top = p00[c] * (1 - dx) + p10[c] * dx
      const bot = p01[c] * (1 - dx) + p11[c] * dx
      res[c] = top * (1 - dy) + bot * dy
    }
    return res
  }

  const samples = Math.max(2, Math.min(5, Math.ceil(Math.max(scaleX, scaleY))))
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let pr = 0, pg = 0, pb = 0, pa = 0
      for (let sy = 0; sy < samples; sy++) {
        const fy = (y + (sy + 0.5) / samples) * scaleY - 0.5
        for (let sx = 0; sx < samples; sx++) {
          const fx = (x + (sx + 0.5) / samples) * scaleX - 0.5
          const s = sampleBilinear(fx, fy)
          pr += s[0]; pg += s[1]; pb += s[2]; pa += s[3]
        }
      }
      const total = samples * samples
      pr /= total; pg /= total; pb /= total; pa /= total
      const di = (y * w + x) * 4
      if (pa <= 1e-4) {
        out.data[di] = 0; out.data[di + 1] = 0; out.data[di + 2] = 0; out.data[di + 3] = 0
      } else {
        out.data[di] = clamp(Math.round(pr / pa), 0, 255)
        out.data[di + 1] = clamp(Math.round(pg / pa), 0, 255)
        out.data[di + 2] = clamp(Math.round(pb / pa), 0, 255)
        out.data[di + 3] = clamp(Math.round(pa * 255), 0, 255)
      }
    }
  }
  return out
}

/** Compose the Architectural Tower Monogram onto a square canvas with sufficient padding so the entire mark is visible. */
function renderMonogramTile(monogramSrc, size, bg = null, ratio = 0.86) {
  const img = new PNG({ width: size, height: size })
  if (bg) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const di = (y * size + x) * 4
        img.data[di] = bg[0]; img.data[di + 1] = bg[1]; img.data[di + 2] = bg[2]; img.data[di + 3] = 255
      }
    }
  }
  const scale = Math.min((size * ratio) / monogramSrc.width, (size * ratio) / monogramSrc.height)
  const mw = Math.max(8, Math.round(monogramSrc.width * scale))
  const mh = Math.max(8, Math.round(monogramSrc.height * scale))
  const mark = resizeSmooth(monogramSrc, mw, mh)
  const ox = Math.round((size - mark.width) / 2)
  const oy = Math.round((size - mark.height) / 2)
  for (let y = 0; y < mark.height; y++) {
    for (let x = 0; x < mark.width; x++) {
      const si = (y * mark.width + x) * 4
      const a = mark.data[si + 3] / 255
      if (a <= 0) continue
      const di = ((y + oy) * size + (x + ox)) * 4
      if (bg) {
        for (let c = 0; c < 3; c++) img.data[di + c] = Math.round(img.data[di + c] * (1 - a) + mark.data[si + c] * a)
        img.data[di + 3] = 255
      } else {
        img.data[di] = mark.data[si]; img.data[di + 1] = mark.data[si + 1]; img.data[di + 2] = mark.data[si + 2]; img.data[di + 3] = mark.data[si + 3]
      }
    }
  }
  return img
}

/**
 * Extract transparent PNG regions (monogram and wordmark) from a studio white-background JPG
 * using connected-component BFS on the solid metallic/ink pixels + 2px anti-aliased edge feathering.
 * This guarantees ZERO clipping of the K spire or W chevron and ZERO ambient drop-shadow halo.
 */
async function extractStudioRegions(page, jpgPath, { yMonogramCentroidMax, yWordmarkEnd }) {
  const b64 = fs.readFileSync(jpgPath).toString('base64')
  const extracted = await page.evaluate(async ({ src, yMonogramCentroidMax, yWordmarkEnd }) => {
    const img = new Image()
    img.src = 'data:image/jpeg;base64,' + src
    await img.decode()
    const width = img.width
    const height = img.height
    const c = document.createElement('canvas')
    c.width = width; c.height = height
    const ctx = c.getContext('2d')
    ctx.drawImage(img, 0, 0)
    const raw = ctx.getImageData(0, 0, width, height).data

    // 1. Classify core metallic/ink pixels vs neutral white/grey studio background & soft drop shadow
    const isCore = new Uint8Array(width * height)
    const alphaMap = new Float32Array(width * height)
    for (let p = 0; p < width * height; p++) {
      const i = p * 4
      const r = raw[i], g = raw[i + 1], b = raw[i + 2]
      const maxC = Math.max(r, g, b)
      const minC = Math.min(r, g, b)
      const sat = maxC - minC
      const lum = r * 0.299 + g * 0.587 + b * 0.114
      const darkness = 255 - lum

      // Studio drop shadow is neutral grey (sat <= 12) and relatively light (lum > 185, darkness < 70).
      // Gold metal has warm saturation (sat >= 16) or dark bronze bevel (darkness >= 68).
      // UAE Red / Green have high saturation; Charcoal PER has high darkness (darkness >= 75).
      const metalSignal = Math.max(
        sat >= 14 ? sat * 2.1 + darkness * 0.45 : 0,
        darkness >= 68 ? (darkness - 52) * 1.8 : 0
      )
      if (metalSignal >= 26) {
        isCore[p] = 1
      }
      const edgeSignal = Math.max(
        sat >= 10 ? (sat - 8) * 2.0 + darkness * 0.35 : 0,
        darkness >= 54 ? (darkness - 48) * 1.65 : 0
      )
      alphaMap[p] = Math.min(1, Math.max(0, (edgeSignal - 6) / 28))
    }

    // 2. Connected components (8-connected BFS) on isCore pixels
    //    Assign group: 1 = Monogram, 2 = Wordmark (SWK + PROPERTIES), 3 = Tagline
    const compGroup = new Uint8Array(width * height)
    const visited = new Uint8Array(width * height)
    const queue = new Int32Array(width * height)

    for (let p = 0; p < width * height; p++) {
      if (!isCore[p] || visited[p]) continue
      let head = 0, tail = 0
      queue[tail++] = p
      visited[p] = 1
      let sumY = 0
      while (head < tail) {
        const cur = queue[head++]
        const cy = Math.floor(cur / width)
        const cx = cur - cy * width
        sumY += cy
        for (let dy = -1; dy <= 1; dy++) {
          const ny = cy + dy
          if (ny < 0 || ny >= height) continue
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue
            const nx = cx + dx
            if (nx < 0 || nx >= width) continue
            const np = ny * width + nx
            if (isCore[np] && !visited[np]) {
              visited[np] = 1
              queue[tail++] = np
            }
          }
        }
      }
      // Noise filter: ignore tiny specks < 12px
      if (tail < 12) continue
      const meanY = sumY / tail
      const grp = meanY < yMonogramCentroidMax ? 1 : (meanY <= yWordmarkEnd ? 2 : 3)
      for (let k = 0; k < tail; k++) {
        compGroup[queue[k]] = grp
      }
    }

    // 3. Dilate component group by 2px into anti-aliased edge pixels (where alphaMap > 0)
    const finalGroup = new Uint8Array(compGroup)
    for (let pass = 0; pass < 2; pass++) {
      const prev = new Uint8Array(finalGroup)
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const p = y * width + x
          if (prev[p] !== 0 || alphaMap[p] <= 0.02) continue
          // Inherit group from nearest 8-neighbor
          for (let dy = -1; dy <= 1 && finalGroup[p] === 0; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const ng = prev[(y + dy) * width + (x + dx)]
              if (ng !== 0) {
                finalGroup[p] = ng
                break
              }
            }
          }
        }
      }
    }

    // 4. Render a specific group (1 = Monogram, 2 = Wordmark) with color unmixing against white
    const renderGroup = (targetGroup, pad = 12) => {
      const outCanvas = document.createElement('canvas')
      outCanvas.width = width; outCanvas.height = height
      const outCtx = outCanvas.getContext('2d')
      const outImg = outCtx.createImageData(width, height)
      const dst = outImg.data

      let minX = width, maxX = 0, minY = height, maxY = 0
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const p = y * width + x
          if (finalGroup[p] !== targetGroup) continue
          const alpha = isCore[p] ? Math.max(0.92, alphaMap[p]) : alphaMap[p]
          if (alpha <= 0.04) continue
          const i = p * 4
          const r = raw[i], g = raw[i + 1], b = raw[i + 2]
          // Unmix white matte on semi-transparent anti-aliased edges
          const ur = Math.max(0, Math.min(255, Math.round((r - 255 * (1 - alpha)) / Math.max(0.35, alpha))))
          const ug = Math.max(0, Math.min(255, Math.round((g - 255 * (1 - alpha)) / Math.max(0.35, alpha))))
          const ub = Math.max(0, Math.min(255, Math.round((b - 255 * (1 - alpha)) / Math.max(0.35, alpha))))
          const ua = Math.round(alpha * 255)
          dst[i] = ur; dst[i + 1] = ug; dst[i + 2] = ub; dst[i + 3] = ua
          if (ua > 20) {
            if (x < minX) minX = x
            if (x > maxX) maxX = x
            if (y < minY) minY = y
            if (y > maxY) maxY = y
          }
        }
      }
      outCtx.putImageData(outImg, 0, 0)
      const cx0 = Math.max(0, minX - pad)
      const cy0 = Math.max(0, minY - pad)
      const cw = Math.min(width - cx0, (maxX - minX + 1) + pad * 2)
      const ch = Math.min(height - cy0, (maxY - minY + 1) + pad * 2)
      const crop = document.createElement('canvas')
      crop.width = cw; crop.height = ch
      crop.getContext('2d').drawImage(outCanvas, cx0, cy0, cw, ch, 0, 0, cw, ch)
      return crop.toDataURL('image/png').split(',')[1]
    }

    return {
      monogramB64: renderGroup(1, 10),
      wordmarkB64: renderGroup(2, 12),
    }
  }, { src: b64, yMonogramCentroidMax, yWordmarkEnd })

  return {
    monogram: PNG.sync.read(Buffer.from(extracted.monogramB64, 'base64')),
    wordmark: PNG.sync.read(Buffer.from(extracted.wordmarkB64, 'base64')),
  }
}

async function main() {
  const chromeCandidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].filter(Boolean)
  const executablePath = chromeCandidates.find(p => fs.existsSync(p))
  if (!executablePath) throw new Error('No Chromium/Chrome binary found for brand extraction')

  const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage()

  // Extract from UAE Studio Master (1024x682) and Gold Studio Master (1024x1024)
  const uae = await extractStudioRegions(page, srcUaeJpg, { yMonogramCentroidMax: 340, yWordmarkEnd: 615 })
  const gold = await extractStudioRegions(page, srcGoldJpg, { yMonogramCentroidMax: 500, yWordmarkEnd: 896 })
  await browser.close()

  // 1. Wordmarks:
  //    - swk-logo-ink.png / swk-logo-dark.png: UAE-coloured PROPERTIES + Brushed Metallic Gold SWK (for light surfaces)
  //    - swk-logo-white.png / swk-logo.png: Pure Brushed Metallic Gold SWK PROPERTIES (for dark/charcoal surfaces)
  const uaeWordmarkBuf = PNG.sync.write(uae.wordmark)
  const goldWordmarkBuf = PNG.sync.write(gold.wordmark)
  fs.writeFileSync(path.join(brandDir, 'swk-logo-ink.png'), uaeWordmarkBuf)
  fs.writeFileSync(path.join(brandDir, 'swk-logo-dark.png'), uaeWordmarkBuf)
  fs.writeFileSync(path.join(brandDir, 'swk-logo-white.png'), goldWordmarkBuf)
  fs.writeFileSync(path.join(brandDir, 'swk-logo.png'), goldWordmarkBuf)

  // 2. Architectural Tower Monogram (512x512 with generous padding)
  const paddedMonogram512 = renderMonogramTile(uae.monogram, 512, null, 0.88)
  fs.writeFileSync(path.join(brandDir, 'swk-mark.png'), PNG.sync.write(paddedMonogram512))

  // 3. Full Studio Lockups (for Welcome / Login showcase)
  fs.writeFileSync(path.join(brandDir, 'swk-signage-logo.png'), fs.readFileSync(srcUaeJpg))
  fs.writeFileSync(path.join(brandDir, 'swk-signage-icon.png'), fs.readFileSync(srcGoldJpg))

  // 4. Favicons & App Icons (from the Architectural Tower Monogram)
  const CHARCOAL_TILE = [32, 36, 33] // #202421
  const favSizes = [16, 32, 48, 64, 128, 180, 192, 256, 512]
  for (const n of favSizes) {
    const t = renderMonogramTile(uae.monogram, n, null, 0.86)
    fs.writeFileSync(path.join(favDir, `favicon-${n}.png`), PNG.sync.write(t))
  }
  const appleIcon = renderMonogramTile(uae.monogram, 180, CHARCOAL_TILE, 0.82)
  const pwa192 = renderMonogramTile(uae.monogram, 192, CHARCOAL_TILE, 0.82)
  const pwa512 = renderMonogramTile(uae.monogram, 512, CHARCOAL_TILE, 0.82)
  fs.writeFileSync(path.join(favDir, 'apple-touch-icon.png'), PNG.sync.write(appleIcon))
  fs.writeFileSync(path.join(root, 'public', 'app-icon-192.png'), PNG.sync.write(pwa192))
  fs.writeFileSync(path.join(root, 'public', 'app-icon-512.png'), PNG.sync.write(pwa512))

  if (fs.existsSync(srcIco)) {
    fs.copyFileSync(srcIco, path.join(favDir, 'favicon.ico'))
  }

  const svgTile = (n) => Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}">` +
    `<image href="/favicon/favicon-512.png" x="${Math.round(n * 0.06)}" y="${Math.round(n * 0.06)}" width="${Math.round(n * 0.88)}" height="${Math.round(n * 0.88)}"/>` +
    `</svg>`
  )
  fs.writeFileSync(path.join(favDir, 'favicon.svg'), svgTile(512))

  // 5. Sync to Android res/drawable & res/mipmap-*
  const resDir = path.join(root, 'android', 'app', 'src', 'main', 'res')
  if (fs.existsSync(resDir)) {
    const mipmapMap = [
      { folder: 'mipmap-mdpi', size: 48 },
      { folder: 'mipmap-hdpi', size: 128 },
      { folder: 'mipmap-xhdpi', size: 192 },
      { folder: 'mipmap-xxhdpi', size: 256 },
      { folder: 'mipmap-xxxhdpi', size: 512 },
    ]
    for (const item of mipmapMap) {
      const targetDir = path.join(resDir, item.folder)
      fs.mkdirSync(targetDir, { recursive: true })
      const launcherTile = PNG.sync.write(renderMonogramTile(uae.monogram, item.size, CHARCOAL_TILE, 0.82))
      fs.writeFileSync(path.join(targetDir, 'ic_launcher.png'), launcherTile)
      fs.writeFileSync(path.join(targetDir, 'ic_launcher_round.png'), launcherTile)
    }
    const drawableDir = path.join(resDir, 'drawable')
    fs.mkdirSync(drawableDir, { recursive: true })
    fs.copyFileSync(path.join(brandDir, 'swk-logo-white.png'), path.join(drawableDir, 'swk_logo_white.png'))
    fs.copyFileSync(path.join(brandDir, 'swk-logo-ink.png'), path.join(drawableDir, 'swk_logo_ink.png'))
    fs.copyFileSync(path.join(brandDir, 'swk-mark.png'), path.join(drawableDir, 'swk_logo.png'))
    fs.copyFileSync(path.join(root, 'public', 'app-icon-512.png'), path.join(drawableDir, 'swk_app_icon.png'))
  }

  console.log('✓ Extracted official studio SWK Properties wordmarks, architectural monogram, and favicons:',
    { uaeWordmark: `${uae.wordmark.width}x${uae.wordmark.height}`, goldWordmark: `${gold.wordmark.width}x${gold.wordmark.height}`, monogram: `${uae.monogram.width}x${uae.monogram.height}` })
}

main().catch(e => { console.error(e); process.exit(1) })
