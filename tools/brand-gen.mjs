/**
 * SWK Properties brand asset pipeline for DigitalBurj Business OS.
 *
 * Source assets (from swkpropertiesuae.com brand kit):
 *   - swk-logo.png  (512x512, white mark, transparent)  -- logos / reverse surfaces
 *   - favicon.png   (180x180, white mark, transparent)  -- small sizes
 *
 * Generated here:
 *   public/brand/swk-logo.png          white master (512)
 *   public/brand/swk-logo-ink.png      ink recolor for light surfaces (640 wide)
 *   public/brand/swk-mark.png          white mark only, trimmed-ish square 512
 *   public/favicon/favicon-<n>.png     ink-on-tile set (16..512)
 *   public/favicon/apple-touch-icon.png
 *   public/favicon/favicon.ico         packed PNG entries 16/32/48
 *   public/favicon/favicon.svg         explicit ink tile SVG
 *   public/app-icon-192.png / 512.png  PWA icons
 */
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { PNG } = require('pngjs')

const root = path.resolve(import.meta.dirname, '..')
const brandDir = path.join(root, 'public', 'brand')
const favDir = path.join(root, 'public', 'favicon')
const srcLogo = path.join(root, 'assets-src', 'swk-logo.png')
const srcFav = path.join(root, 'assets-src', 'favicon.png')
const INK = [15, 23, 20] // #0f1714 DigitalBurj ink
const TILE = [13, 19, 16] // #0d1310 favicon tile

fs.mkdirSync(brandDir, { recursive: true })
fs.mkdirSync(favDir, { recursive: true })

const pngOf = (file) => PNG.sync.read(fs.readFileSync(file))

/** Resize RGBA nearest (good enough for logo downscale at these sizes). */
function resize(src, w, h) {
  if (src.width === w && src.height === h) return src
  const out = new PNG({ width: w, height: h })
  for (let y = 0; y < h; y++) {
    const sy = Math.min(src.height - 1, (y * src.height / h) | 0)
    for (let x = 0; x < w; x++) {
      const sx = Math.min(src.width - 1, (x * src.width / w) | 0)
      const si = (sy * src.width + sx) * 4, di = (y * w + x) * 4
      for (let c = 0; c < 4; c++) out.data[di + c] = src.data[si + c]
    }
  }
  return out
}

/** Recolor every visible pixel so white -> ink, greys -> ink-tinted greys. */
function recolor(src, rgb) {
  const out = new PNG({ width: src.width, height: src.height })
  out.data.set(src.data)
  for (let i = 0; i < out.data.length; i += 4) {
    const a = out.data[i + 3]
    if (a === 0) continue
    for (let c = 0; c < 3; c++) {
      // scale luminance: source near-white maps to rgb, grey mid-tones keep shading
      out.data[i + c] = Math.round(out.data[i + c] / 255 * rgb[c])
    }
    out.data[i + 3] = a
  }
  return out
}

/** Compose resized src centered on an oversized square tile with padding. */
function tile(srcMaster, size, bg, ratio = 0.74) {
  const img = new PNG({ width: size, height: size })
  const mark = resize(srcMaster, Math.round(size * ratio), Math.round(size * ratio))
  // srcMaster is square so mark is square
  const ox = Math.round((size - mark.width) / 2), oy = Math.round((size - mark.height) / 2)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const di = (y * size + x) * 4
      if (!bg) continue
      img.data[di] = bg[0]; img.data[di + 1] = bg[1]; img.data[di + 2] = bg[2]; img.data[di + 3] = 255
    }
  }
  for (let y = 0; y < mark.height; y++) {
    for (let x = 0; x < mark.width; x++) {
      const si = (y * mark.width + x) * 4, di = ((y + oy) * size + (x + ox)) * 4
      const a = mark.data[si + 3] / 255
      if (a === 0) continue
      for (let c = 0; c < 3; c++) img.data[di + c] = Math.round(img.data[di + c] * (1 - a) + mark.data[si + c] * a)
      img.data[di + 3] = 255
    }
  }
  return img
}

/** Find content bounds (non-transparent) — used to trim the wordmark band. */
function bounds(p) {
  let minX = p.width, minY = p.height, maxX = 0, maxY = 0
  for (let y = 0; y < p.height; y++) for (let x = 0; x < p.width; x++) {
    if (p.data[(y * p.width + x) * 4 + 3] > 8) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y }
  }
  return { minX, minY, maxX: maxX + 1, maxY: maxY + 1 }
}

function crop(p, b) {
  const w = b.maxX - b.minX, h = b.maxY - b.minY
  const out = new PNG({ width: w, height: h })
  for (let y = 0; y < h; y++) {
    const si = ((y + b.minY) * p.width + b.minX) * 4, di = y * w * 4
    out.data.set(p.data.subarray(si, si + w * 4), di)
  }
  return out
}

/* ---- write public/brand masters ---- */
fs.copyFileSync(srcLogo, path.join(brandDir, 'swk-logo.png'))

const master = pngOf(srcLogo)
const fav = pngOf(srcFav)

// ink version for light surfaces (topbar, print sheets, public tracking) — bounds-trimmed so no dead padding shrinks the mark
const ink = crop(recolor(master, INK), bounds(recolor(master, INK)))
fs.writeFileSync(path.join(brandDir, 'swk-logo-ink.png'), PNG.sync.write(ink))

/* ---- favicon / app-icon tiles (ink tile, white mark) ---- */
const sizes = [16, 32, 48, 64, 128, 180, 192, 256, 512]
const favMaster = fav // 180x180 white mark
for (const n of sizes) {
  const t = tile(favMaster, n, TILE, 0.8)
  fs.writeFileSync(path.join(favDir, `favicon-${n}.png`), PNG.sync.write(t))
}
fs.copyFileSync(path.join(favDir, 'favicon-180.png'), path.join(favDir, 'apple-touch-icon.png'))
fs.copyFileSync(path.join(favDir, 'favicon-192.png'), path.join(root, 'public', 'app-icon-192.png'))
fs.copyFileSync(path.join(favDir, 'favicon-512.png'), path.join(root, 'public', 'app-icon-512.png'))

const svgTile = (n) => Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}"><rect width="${n}" height="${n}" fill="#0d1310"/><image href="/favicon/favicon-512.png" x="${Math.round(n * .1)}" y="${Math.round(n * .1)}" width="${Math.round(n * .8)}" height="${Math.round(n * .8)}"/></svg>`)
fs.writeFileSync(path.join(favDir, 'favicon.svg'), svgTile(512))

/* ---- favicon.ico: PNG entry directory (modern browsers render them) ---- */
function icoWrite(entries) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(entries.length, 4)
  const dirSize = 16 * entries.length
  let offset = 6 + dirSize
  const dir = Buffer.alloc(dirSize)
  const blobs = []
  entries.forEach((e, i) => {
    const b = fs.readFileSync(e)
    blobs.push(b)
    const s = PNG.sync.read(b)
    dir.writeUInt8(s.width >= 256 ? 0 : s.width, i * 16)
    dir.writeUInt8(s.height >= 256 ? 0 : s.height, i * 16 + 1)
    dir.writeUInt8(0, i * 16 + 2) // palette
    dir.writeUInt8(0, i * 16 + 3)
    dir.writeUInt16LE(1, i * 16 + 4)
    dir.writeUInt16LE(32, i * 16 + 6)
    dir.writeUInt32LE(b.length, i * 16 + 8)
    dir.writeUInt32LE(offset, i * 16 + 12)
    offset += b.length
  })
  return Buffer.concat([header, dir, ...blobs])
}
fs.writeFileSync(path.join(favDir, 'favicon.ico'), icoWrite([
  path.join(favDir, 'favicon-16.png'), path.join(favDir, 'favicon-32.png'), path.join(favDir, 'favicon-48.png'),
]))

console.log('brand assets generated:',
  fs.readdirSync(brandDir), '| favicons:', fs.readdirSync(favDir))
