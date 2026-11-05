/**
 * SWK OS Brand Asset Pipeline.
 *
 * Uses the official SWK OS Brand Pack in assets-src/SWK_OS_Brand_Pack/:
 *   - Master/     Editable satin and flat SVGs (ForDark & ForLight)
 *   - Logo/       Horizontal, Stacked, and Wordmark-only SVGs & PNGs (ForDark & ForLight)
 *   - Icon/       Standalone architectural crest SVGs & PNGs (ForDark & ForLight)
 *   - App_Icon/   Dark (#102E29) & Light (#F8F4EC) 1024px tiles, SVGs, iOS AppIcon.appiconset, and Android adaptive/legacy mipmaps
 *   - Favicon/    SVG, multi-size ICO, 16/32/48 PNGs, and 180x180 apple-touch-icon.png
 *
 * Syncs all web, PWA, favicon, OpenGraph, print, and brand library assets across public/ and assets-src/.
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { PNG } = require('pngjs')

const root = path.resolve(import.meta.dirname, '..')
const packDir = path.join(root, 'assets-src', 'SWK_OS_Brand_Pack')
const pubDir = path.join(root, 'public')
const brandDir = path.join(pubDir, 'brand')
const favDir = path.join(pubDir, 'favicon')
const swkOsDir = path.join(brandDir, 'swk-os')

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

/** Compose a source PNG onto a w x h canvas with optional solid background and fit ratio. */
function composeOnCanvas(src, w, h, bg = null, ratio = 0.78) {
  const img = new PNG({ width: w, height: h })
  if (bg) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const di = (y * w + x) * 4
        img.data[di] = bg[0]; img.data[di + 1] = bg[1]; img.data[di + 2] = bg[2]; img.data[di + 3] = 255
      }
    }
  }
  const scale = Math.min((w * ratio) / src.width, (h * ratio) / src.height)
  const mw = Math.max(8, Math.round(src.width * scale))
  const mh = Math.max(8, Math.round(src.height * scale))
  const mark = resizeSmooth(src, mw, mh)
  const ox = Math.round((w - mark.width) / 2)
  const oy = Math.round((h - mark.height) / 2)
  for (let y = 0; y < mark.height; y++) {
    for (let x = 0; x < mark.width; x++) {
      const si = (y * mark.width + x) * 4
      const a = mark.data[si + 3] / 255
      if (a <= 0) continue
      const di = ((y + oy) * w + (x + ox)) * 4
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

function copyFromPack(srcRel, destAbs) {
  const srcAbs = path.join(packDir, srcRel)
  fs.mkdirSync(path.dirname(destAbs), { recursive: true })
  fs.copyFileSync(srcAbs, destAbs)
}

function copyTree(srcDir, destDir) {
  fs.mkdirSync(destDir, { recursive: true })
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const s = path.join(srcDir, entry.name)
    const d = path.join(destDir, entry.name)
    if (entry.isDirectory()) copyTree(s, d)
    else fs.copyFileSync(s, d)
  }
}

function main() {
  if (!fs.existsSync(packDir)) {
    throw new Error(`Missing SWK_OS_Brand_Pack directory at ${packDir}`)
  }

  // 1. Sync full SWK_OS_Brand_Pack tree into public/brand/swk-os/
  copyTree(packDir, swkOsDir)

  // Also update legacy paths inside public/brand/swk-os/ so any direct references stay in sync
  for (const name of ['SWK_Emblem.svg', 'SWK_Emblem_Transparent.svg']) {
    copyFromPack('Icon/SWK_OS_Crest_ForDark.svg', path.join(swkOsDir, 'Icon', name))
  }
  for (const sz of ['128', '256', '512', '1024', '2048']) {
    copyFromPack('Icon/SWK_OS_Crest_ForDark.png', path.join(swkOsDir, 'Icon', `SWK_Emblem_${sz}.png`))
    copyFromPack('Icon/SWK_OS_Crest_ForDark.png', path.join(swkOsDir, 'Icon', `SWK_Emblem_Transparent_${sz}.png`))
  }
  copyFromPack('Logo/SWK_OS_Horizontal_ForDark.svg', path.join(swkOsDir, 'Logos', 'SWK_OS_Horizontal_Logo.svg'))
  copyFromPack('Logo/SWK_OS_Horizontal_ForDark.svg', path.join(swkOsDir, 'Logos', 'SWK_OS_Horizontal_Logo_Transparent.svg'))
  copyFromPack('Logo/SWK_OS_Stacked_ForDark.svg', path.join(swkOsDir, 'Logos', 'SWK_OS_Stacked_Logo.svg'))
  copyFromPack('Logo/SWK_OS_Stacked_ForDark.svg', path.join(swkOsDir, 'Logos', 'SWK_OS_Stacked_Logo_Transparent.svg'))
  copyFromPack('Logo/SWK_OS_Wordmark_ForDark.svg', path.join(swkOsDir, 'Logos', 'SWK_OS_Wordmark_Logo.svg'))
  copyFromPack('Logo/SWK_OS_Wordmark_ForDark.svg', path.join(swkOsDir, 'Logos', 'SWK_OS_Wordmark_Logo_Transparent.svg'))
  for (const sz of ['512', '1024', '2048', '4096']) {
    copyFromPack('Logo/SWK_OS_Horizontal_ForDark.png', path.join(swkOsDir, 'Logos', `SWK_OS_Horizontal_Logo_${sz}.png`))
    copyFromPack('Logo/SWK_OS_Horizontal_ForDark.png', path.join(swkOsDir, 'Logos', `SWK_OS_Horizontal_Logo_Transparent_${sz}.png`))
    copyFromPack('Logo/SWK_OS_Stacked_ForDark.png', path.join(swkOsDir, 'Logos', `SWK_OS_Stacked_Logo_${sz}.png`))
    copyFromPack('Logo/SWK_OS_Stacked_ForDark.png', path.join(swkOsDir, 'Logos', `SWK_OS_Stacked_Logo_Transparent_${sz}.png`))
    copyFromPack('Logo/SWK_OS_Wordmark_ForDark.png', path.join(swkOsDir, 'Logos', `SWK_OS_Wordmark_Logo_${sz}.png`))
    copyFromPack('Logo/SWK_OS_Wordmark_ForDark.png', path.join(swkOsDir, 'Logos', `SWK_OS_Wordmark_Logo_Transparent_${sz}.png`))
  }
  copyFromPack('Master/SWK_OS_Master_Satin_ForDark.svg', path.join(swkOsDir, 'Master', 'SWK_OS_Master.svg'))
  copyFromPack('Master/SWK_OS_Master_Satin_ForDark.svg', path.join(swkOsDir, 'Master', 'SWK_OS_Master_Transparent.svg'))
  copyFromPack('Logo/SWK_OS_Horizontal_ForDark.png', path.join(swkOsDir, 'Master', 'SWK_OS_Master_4096.png'))

  // 2. Top-level /brand/* SVGs and PNGs used across Web, Print, and Reception QR
  copyFromPack('Icon/SWK_OS_Crest_ForDark.svg', path.join(brandDir, 'swk-os-emblem.svg'))
  copyFromPack('Icon/SWK_OS_Crest_ForDark.svg', path.join(brandDir, 'swk-os-emblem-dark.svg'))
  copyFromPack('Icon/SWK_OS_Crest_ForLight.svg', path.join(brandDir, 'swk-os-emblem-light.svg'))
  copyFromPack('Icon/SWK_OS_Crest_ForDark.svg', path.join(brandDir, 'swk-properties-emblem.svg'))
  copyFromPack('Icon/SWK_OS_Crest_ForDark.svg', path.join(brandDir, 'swk-mark.svg'))

  copyFromPack('Logo/SWK_OS_Wordmark_ForDark.svg', path.join(brandDir, 'swk-os-wordmark.svg'))
  copyFromPack('Logo/SWK_OS_Wordmark_ForDark.svg', path.join(brandDir, 'swk-os-wordmark-dark.svg'))
  copyFromPack('Logo/SWK_OS_Wordmark_ForLight.svg', path.join(brandDir, 'swk-os-wordmark-light.svg'))
  copyFromPack('Logo/SWK_OS_Wordmark_ForDark.svg', path.join(brandDir, 'swk-properties-wordmark.svg'))

  copyFromPack('Logo/SWK_OS_Horizontal_ForDark.svg', path.join(brandDir, 'swk-os-horizontal.svg'))
  copyFromPack('Logo/SWK_OS_Horizontal_ForDark.svg', path.join(brandDir, 'swk-os-horizontal-dark.svg'))
  copyFromPack('Logo/SWK_OS_Horizontal_ForLight.svg', path.join(brandDir, 'swk-os-horizontal-light.svg'))
  copyFromPack('Logo/SWK_OS_Horizontal_ForDark.svg', path.join(brandDir, 'swk-properties-horizontal.svg'))
  copyFromPack('Logo/SWK_OS_Horizontal_ForLight.svg', path.join(brandDir, 'swk-properties-horizontal-dark.svg'))
  copyFromPack('Logo/SWK_OS_Horizontal_ForDark.svg', path.join(brandDir, 'swk-logo.svg'))

  copyFromPack('Logo/SWK_OS_Stacked_ForDark.svg', path.join(brandDir, 'swk-os-stacked.svg'))
  copyFromPack('Logo/SWK_OS_Stacked_ForLight.svg', path.join(brandDir, 'swk-os-stacked-light.svg'))
  copyFromPack('Logo/SWK_OS_Stacked_ForDark.svg', path.join(brandDir, 'swk-properties-stacked.svg'))

  copyFromPack('Master/SWK_OS_Master_Satin_ForDark.svg', path.join(brandDir, 'swk-os-master.svg'))
  copyFromPack('Master/SWK_OS_Master_Satin_ForLight.svg', path.join(brandDir, 'swk-os-master-light.svg'))

  copyFromPack('Icon/SWK_OS_Crest_ForDark.png', path.join(brandDir, 'swk-mark.png'))
  copyFromPack('Icon/SWK_OS_Crest_ForLight.png', path.join(brandDir, 'swk-mark-light.png'))
  copyFromPack('Icon/SWK_OS_Crest_ForLight.png', path.join(brandDir, 'swk-mark-black.png'))
  copyFromPack('Icon/SWK_OS_Crest_ForDark.png', path.join(brandDir, 'swk-signage-icon.png'))

  copyFromPack('Logo/SWK_OS_Wordmark_ForDark.png', path.join(brandDir, 'swk-logo-white.png'))
  copyFromPack('Logo/SWK_OS_Wordmark_ForLight.png', path.join(brandDir, 'swk-logo-ink.png'))
  copyFromPack('Logo/SWK_OS_Wordmark_ForDark.png', path.join(brandDir, 'swk-logo-dark.png'))

  copyFromPack('Logo/SWK_OS_Horizontal_ForDark.png', path.join(brandDir, 'logo-primary.png'))
  copyFromPack('Logo/SWK_OS_Horizontal_ForDark.png', path.join(brandDir, 'swk-logo-gold.png'))
  copyFromPack('Logo/SWK_OS_Horizontal_ForDark.png', path.join(brandDir, 'swk-logo.png'))
  copyFromPack('Logo/SWK_OS_Horizontal_ForDark.png', path.join(brandDir, 'swk-full-logo-dark.png'))
  copyFromPack('Logo/SWK_OS_Horizontal_ForLight.png', path.join(brandDir, 'swk-full-logo-light.png'))
  copyFromPack('Logo/SWK_OS_Horizontal_ForDark.png', path.join(brandDir, 'swk-properties-horizontal.png'))
  copyFromPack('Logo/SWK_OS_Stacked_ForDark.png', path.join(brandDir, 'swk-signage-logo.png'))

  // 3. Favicons & PWA App Icons (exact pixel dimensions verified by tests/pwa.ts)
  const appDark1024 = PNG.sync.read(fs.readFileSync(path.join(packDir, 'App_Icon/SWK_OS_App_Dark_1024.png')))
  const png64 = PNG.sync.write(resizeSmooth(appDark1024, 64, 64))
  const png128 = PNG.sync.write(resizeSmooth(appDark1024, 128, 128))
  const png256 = PNG.sync.write(resizeSmooth(appDark1024, 256, 256))

  for (const targetFavDir of [pubDir, favDir, path.join(brandDir, 'favicon'), path.join(swkOsDir, 'Favicon')]) {
    copyFromPack('Favicon/favicon.svg', path.join(targetFavDir, 'favicon.svg'))
    copyFromPack('Favicon/favicon.svg', path.join(targetFavDir, 'favicon-16.svg'))
    copyFromPack('Favicon/favicon.ico', path.join(targetFavDir, 'favicon.ico'))
    copyFromPack('Favicon/apple-touch-icon.png', path.join(targetFavDir, 'apple-touch-icon.png'))
    copyFromPack('Favicon/apple-touch-icon.png', path.join(targetFavDir, 'favicon-180.png'))
    copyFromPack('Favicon/favicon-16.png', path.join(targetFavDir, 'favicon-16.png'))
    copyFromPack('Favicon/favicon-32.png', path.join(targetFavDir, 'favicon-32.png'))
    copyFromPack('Favicon/favicon-48.png', path.join(targetFavDir, 'favicon-48.png'))
    copyFromPack('App_Icon/Android/res/mipmap-xhdpi/ic_launcher.png', path.join(targetFavDir, 'favicon-96.png'))
    copyFromPack('App_Icon/Android/res/mipmap-xxxhdpi/ic_launcher.png', path.join(targetFavDir, 'favicon-192.png'))
    copyFromPack('App_Icon/Android/Play_Store_512.png', path.join(targetFavDir, 'favicon-512.png'))
    fs.writeFileSync(path.join(targetFavDir, 'favicon-64.png'), png64)
    fs.writeFileSync(path.join(targetFavDir, 'favicon-128.png'), png128)
    fs.writeFileSync(path.join(targetFavDir, 'favicon-256.png'), png256)
  }

  copyFromPack('App_Icon/Android/res/mipmap-xxxhdpi/ic_launcher.png', path.join(pubDir, 'app-icon-192.png'))
  copyFromPack('App_Icon/Android/Play_Store_512.png', path.join(pubDir, 'app-icon-512.png'))
  copyFromPack('App_Icon/Android/res/mipmap-xxxhdpi/ic_launcher.png', path.join(pubDir, 'icon-192.png'))
  copyFromPack('App_Icon/Android/Play_Store_512.png', path.join(pubDir, 'icon-512.png'))
  copyFromPack('Logo/SWK_OS_Horizontal_ForDark.png', path.join(pubDir, 'swk-logo.png'))

  // 4. public/brand/app-icons/* & sub-libraries
  copyFromPack('App_Icon/Android/res/mipmap-xxxhdpi/ic_launcher.png', path.join(brandDir, 'app-icons', 'android-chrome-192x192.png'))
  copyFromPack('App_Icon/Android/Play_Store_512.png', path.join(brandDir, 'app-icons', 'android-chrome-512x512.png'))
  copyFromPack('App_Icon/Android/res/mipmap-xxxhdpi/ic_launcher.png', path.join(brandDir, 'app-icons', 'maskable-192x192.png'))
  copyFromPack('App_Icon/Android/Play_Store_512.png', path.join(brandDir, 'app-icons', 'maskable-512x512.png'))
  copyFromPack('Favicon/apple-touch-icon.png', path.join(brandDir, 'app-icons', 'apple-touch-icon.png'))
  copyFromPack('App_Icon/iOS/AppIcon.appiconset/AppIcon-1024.png', path.join(brandDir, 'app-icons', 'app-store-1024.png'))

  for (const variantDir of [
    path.join(brandDir, 'app-icons', 'Emblem_and_SWK'),
    path.join(brandDir, 'app-icons', 'SWK_Wordmark'),
    path.join(swkOsDir, 'App_Icons', 'Emblem_and_SWK'),
    path.join(swkOsDir, 'App_Icons', 'SWK_Wordmark'),
  ]) {
    copyFromPack('App_Icon/SWK_OS_App_Dark.svg', path.join(variantDir, 'App_Icon_Master.svg'))
    copyFromPack('App_Icon/Android/Play_Store_512.png', path.join(variantDir, 'Android', 'Google-Play-512.png'))
    copyTree(path.join(packDir, 'App_Icon', 'Android', 'res'), path.join(variantDir, 'Android', 'res'))
    copyTree(path.join(packDir, 'App_Icon', 'iOS'), path.join(variantDir, 'iOS'))
  }

  for (const n of [16, 32, 48]) {
    copyFromPack(`Favicon/favicon-${n}.png`, path.join(brandDir, 'favicon', `favicon-dark-${n}.png`))
    copyFromPack(`Favicon/favicon-${n}.png`, path.join(brandDir, 'favicon', `favicon-light-${n}.png`))
  }
  fs.writeFileSync(path.join(brandDir, 'favicon', 'favicon-dark-64.png'), png64)
  fs.writeFileSync(path.join(brandDir, 'favicon', 'favicon-light-64.png'), png64)
  copyFromPack('Favicon/favicon.ico', path.join(brandDir, 'favicon', 'favicon-dark.ico'))
  copyFromPack('Favicon/favicon.ico', path.join(brandDir, 'favicon', 'favicon-light.ico'))

  // 5. public/brand/masters/*, logos/*, wordmark/*, monochrome/*, tagline/*, icons/*
  copyFromPack('Logo/SWK_OS_Horizontal_ForLight.png', path.join(brandDir, 'masters', 'swk-primary.png'))
  copyFromPack('Logo/SWK_OS_Horizontal_ForLight.png', path.join(brandDir, 'masters', 'swk-primary-approved-original.png'))
  copyFromPack('Logo/SWK_OS_Horizontal_ForDark.png', path.join(brandDir, 'masters', 'swk-dark.png'))
  copyFromPack('Logo/SWK_OS_Horizontal_ForDark.png', path.join(brandDir, 'masters', 'swk-dark-companion-original.png'))
  copyFromPack('Icon/SWK_OS_Crest_ForDark.png', path.join(brandDir, 'masters', 'swk-icon.png'))
  copyFromPack('Icon/SWK_OS_Crest_ForDark.png', path.join(brandDir, 'masters', 'swk-icon-original.png'))
  copyFromPack('Icon/SWK_OS_Crest_ForLight.png', path.join(brandDir, 'masters', 'swk-icon-approved-white-reference.png'))
  copyFromPack('Logo/SWK_OS_Wordmark_ForDark.png', path.join(brandDir, 'masters', 'swk-wordmark.png'))

  for (const w of ['240', '320', '480', '640', '960', '1280', '1600', '4096-upscaled']) {
    copyFromPack('Logo/SWK_OS_Horizontal_ForDark.png', path.join(brandDir, 'logos', 'dark', `swk-properties-${w}.png`))
    copyFromPack('Logo/SWK_OS_Horizontal_ForLight.png', path.join(brandDir, 'logos', 'light', `swk-properties-${w}.png`))
  }
  for (const w of ['320', '640', '1280', '1600']) {
    copyFromPack('Logo/SWK_OS_Wordmark_ForDark.png', path.join(brandDir, 'wordmark', `swk-wordmark-${w}.png`))
  }
  copyFromPack('Logo/SWK_OS_Wordmark_ForLight.png', path.join(brandDir, 'wordmark', 'swk-wordmark-black.png'))
  copyFromPack('Logo/SWK_OS_Wordmark_ForDark.png', path.join(brandDir, 'wordmark', 'swk-wordmark-flat-gold.png'))
  copyFromPack('Logo/SWK_OS_Wordmark_ForDark.png', path.join(brandDir, 'wordmark', 'swk-wordmark-white.png'))
  copyFromPack('Logo/SWK_OS_Horizontal_ForLight.png', path.join(brandDir, 'monochrome', 'swk-properties-black.png'))
  copyFromPack('Logo/SWK_OS_Horizontal_ForDark.png', path.join(brandDir, 'monochrome', 'swk-properties-flat-gold.png'))
  copyFromPack('Logo/SWK_OS_Horizontal_ForDark.png', path.join(brandDir, 'monochrome', 'swk-properties-white.png'))
  copyFromPack('Icon/SWK_OS_Crest_ForLight.png', path.join(brandDir, 'icons', 'monochrome', 'swk-icon-black.png'))
  copyFromPack('Icon/SWK_OS_Crest_ForDark.png', path.join(brandDir, 'icons', 'monochrome', 'swk-icon-flat-gold.png'))
  copyFromPack('Icon/SWK_OS_Crest_ForDark.png', path.join(brandDir, 'icons', 'monochrome', 'swk-icon-white.png'))
  copyFromPack('Logo/SWK_OS_Horizontal_ForDark.png', path.join(brandDir, 'tagline', 'swk-with-tagline-dark.png'))
  copyFromPack('Logo/SWK_OS_Horizontal_ForLight.png', path.join(brandDir, 'tagline', 'swk-with-tagline-light.png'))

  const crestDark512 = PNG.sync.read(fs.readFileSync(path.join(packDir, 'Icon/SWK_OS_Crest_ForDark.png')))
  for (const n of [16, 32, 48, 64, 96, 128, 180, 192, 256, 512, 1024, 2048]) {
    const out = n === 512 ? crestDark512 : resizeSmooth(crestDark512, n, n)
    const dest = path.join(brandDir, 'icons', 'transparent', `swk-icon-${n}.png`)
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.writeFileSync(dest, PNG.sync.write(out))
  }

  // 6. OpenGraph & Social Cards (1200x630 & 1080x1080 on official SWK OS #102E29 Dark & #F8F4EC Light surfaces)
  const horizDark = PNG.sync.read(fs.readFileSync(path.join(packDir, 'Logo/SWK_OS_Horizontal_ForDark.png')))
  const horizLight = PNG.sync.read(fs.readFileSync(path.join(packDir, 'Logo/SWK_OS_Horizontal_ForLight.png')))
  const ogDark = composeOnCanvas(horizDark, 1200, 630, [16, 46, 41], 0.78)
  const ogLight = composeOnCanvas(horizLight, 1200, 630, [248, 244, 236], 0.78)
  const ogDarkBuf = PNG.sync.write(ogDark)
  fs.writeFileSync(path.join(pubDir, 'og.png'), ogDarkBuf)
  fs.mkdirSync(path.join(brandDir, 'social'), { recursive: true })
  fs.writeFileSync(path.join(brandDir, 'social', 'social-card-charcoal-1200x630.png'), ogDarkBuf)
  fs.writeFileSync(path.join(brandDir, 'social', 'social-card-pearl-1200x630.png'), PNG.sync.write(ogLight))
  fs.writeFileSync(path.join(brandDir, 'social', 'avatar-charcoal-1080.png'), PNG.sync.write(composeOnCanvas(appDark1024, 1080, 1080, [16, 46, 41], 1.0)))
  const appLight1024 = PNG.sync.read(fs.readFileSync(path.join(packDir, 'App_Icon/SWK_OS_App_Light_1024.png')))
  fs.writeFileSync(path.join(brandDir, 'social', 'avatar-pearl-1080.png'), PNG.sync.write(composeOnCanvas(appLight1024, 1080, 1080, [248, 244, 236], 1.0)))

  // 7. assets-src root convenience copies
  copyFromPack('Icon/SWK_OS_Crest_ForDark.png', path.join(root, 'assets-src', 'swk-logo.png'))
  copyFromPack('Favicon/favicon.ico', path.join(root, 'assets-src', 'SWK_favicon.ico'))
  copyFromPack('App_Icon/Android/Play_Store_512.png', path.join(root, 'assets-src', 'SWK_favicon_512.png'))
  copyFromPack('App_Icon/Android/Play_Store_512.png', path.join(root, 'assets-src', 'favicon.png'))

  console.log('✓ Synced SWK_OS_Brand_Pack logos, crests, favicons, PWA icons, OpenGraph cards, and Android/iOS app icons.')
}

main()
