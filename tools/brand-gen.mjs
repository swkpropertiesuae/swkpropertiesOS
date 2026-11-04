/**
 * SWK Properties Matte Gold Brand Asset Pipeline for SWK OS & SWK ONE.
 *
 * Uses the official Matte Gold brand package in assets-src/Matte_gold/:
 *   - black/                  Solid black (#000000) background variants (Emblem_only, Favicons_Emblem_only, Favicons_SWK_only, Full_logo, SWK_only)
 *   - white/                  Solid white (#FFFFFF) background variants
 *   - transparent_for_black/  Transparent background variants optimized for dark/charcoal/midnight surfaces
 *   - transparent_for_white/  Transparent background variants optimized for light/ivory/white surfaces & print
 *
 * Updates all web, PWA, favicon, OpenGraph, brand library, and Android native launcher/adaptive/splash assets.
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { PNG } = require('pngjs')

const root = path.resolve(import.meta.dirname, '..')
const matteDir = path.join(root, 'assets-src', 'Matte_gold')
const pubDir = path.join(root, 'public')
const brandDir = path.join(pubDir, 'brand')
const favDir = path.join(pubDir, 'favicon')

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

function makeWhiteSilhouette(src, w, h, ratio = 0.72) {
  const fitted = composeOnCanvas(src, w, h, null, ratio)
  for (let i = 0; i < fitted.data.length; i += 4) {
    const a = fitted.data[i + 3]
    if (a > 0) {
      fitted.data[i] = 255
      fitted.data[i + 1] = 255
      fitted.data[i + 2] = 255
      fitted.data[i + 3] = Math.min(255, Math.round(a * 1.25))
    }
  }
  return fitted
}

function copyFile(srcRel, destAbs) {
  const srcAbs = path.join(matteDir, srcRel)
  fs.mkdirSync(path.dirname(destAbs), { recursive: true })
  fs.copyFileSync(srcAbs, destAbs)
}

function main() {
  if (!fs.existsSync(matteDir)) {
    throw new Error(`Missing Matte_gold directory at ${matteDir}`)
  }

  // 1. Primary /brand/* assets used throughout Web & Mobile UI
  //    - swk-mark.png: 512x512 transparent Emblem (for sidebars, headers, badges, launcher)
  copyFile('transparent_for_black/Favicons_Emblem_only/512x512.png', path.join(brandDir, 'swk-mark.png'))
  copyFile('transparent_for_white/Favicons_Emblem_only/512x512.png', path.join(brandDir, 'swk-mark-light.png'))
  copyFile('black/Favicons_Emblem_only/512x512.png', path.join(brandDir, 'swk-mark-black.png'))

  //    - swk-logo-white.png: Transparent SWK wordmark for dark/charcoal/midnight surfaces
  //    - swk-logo-ink.png / swk-logo-dark.png: Transparent SWK wordmark for light/ivory/white surfaces & print
  //    - swk-logo.png: Full Matte Gold SWK OS Lockup (Emblem + SWK + OS)
  copyFile('transparent_for_black/SWK_only/SWK_OS_SWK_only_1024px.png', path.join(brandDir, 'swk-logo-white.png'))
  copyFile('transparent_for_white/SWK_only/SWK_OS_SWK_only_1024px.png', path.join(brandDir, 'swk-logo-ink.png'))
  copyFile('transparent_for_white/SWK_only/SWK_OS_SWK_only_1024px.png', path.join(brandDir, 'swk-logo-dark.png'))
  copyFile('transparent_for_black/Full_logo/SWK_OS_Full_logo_1024px.png', path.join(brandDir, 'swk-logo.png'))
  copyFile('transparent_for_black/Full_logo/SWK_OS_Full_logo_1024px.png', path.join(brandDir, 'swk-full-logo-dark.png'))
  copyFile('transparent_for_white/Full_logo/SWK_OS_Full_logo_1024px.png', path.join(brandDir, 'swk-full-logo-light.png'))

  //    - swk-signage-logo.png & swk-signage-icon.png: Hero / Login / Reception Showcase lockups
  copyFile('black/Full_logo/SWK_OS_Full_logo_2048px.png', path.join(brandDir, 'swk-signage-logo.png'))
  copyFile('black/Emblem_only/SWK_OS_Emblem_only_1024px.png', path.join(brandDir, 'swk-signage-icon.png'))

  // 3. Root public/ icons, favicons & PWA icons
  copyFile('transparent_for_black/Favicons_Emblem_only/favicon.ico', path.join(pubDir, 'favicon.ico'))
  copyFile('transparent_for_black/Favicons_Emblem_only/32x32.png', path.join(pubDir, 'favicon-32.png'))
  copyFile('black/Favicons_Emblem_only/180x180.png', path.join(pubDir, 'apple-touch-icon.png'))
  copyFile('black/Favicons_Emblem_only/192x192.png', path.join(pubDir, 'app-icon-192.png'))
  copyFile('black/Favicons_Emblem_only/512x512.png', path.join(pubDir, 'app-icon-512.png'))
  copyFile('black/Favicons_Emblem_only/192x192.png', path.join(pubDir, 'icon-192.png'))
  copyFile('black/Favicons_Emblem_only/512x512.png', path.join(pubDir, 'icon-512.png'))
  copyFile('transparent_for_black/Full_logo/SWK_OS_Full_logo_1024px.png', path.join(pubDir, 'swk-logo.png'))

  // 4. public/favicon/* (All sizes 16..512, apple-touch-icon, favicon.ico, favicon.svg)
  const favSizes = [16, 32, 48, 64, 96, 128, 180, 192, 256, 512]
  for (const n of favSizes) {
    copyFile(`transparent_for_black/Favicons_Emblem_only/${n}x${n}.png`, path.join(favDir, `favicon-${n}.png`))
  }
  copyFile('black/Favicons_Emblem_only/180x180.png', path.join(favDir, 'apple-touch-icon.png'))
  copyFile('transparent_for_black/Favicons_Emblem_only/favicon.ico', path.join(favDir, 'favicon.ico'))

  const b64Fav512 = fs.readFileSync(path.join(favDir, 'favicon-512.png')).toString('base64')
  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><image href="data:image/png;base64,${b64Fav512}" x="0" y="0" width="512" height="512"/></svg>`
  fs.writeFileSync(path.join(favDir, 'favicon.svg'), svgContent)

  // 5. public/brand/app-icons/* & public/brand/favicon/* & public/brand/icons/* & public/brand/masters/*
  copyFile('black/Favicons_Emblem_only/192x192.png', path.join(brandDir, 'app-icons', 'android-chrome-192x192.png'))
  copyFile('black/Favicons_Emblem_only/512x512.png', path.join(brandDir, 'app-icons', 'android-chrome-512x512.png'))
  copyFile('black/Favicons_Emblem_only/192x192.png', path.join(brandDir, 'app-icons', 'maskable-192x192.png'))
  copyFile('black/Favicons_Emblem_only/512x512.png', path.join(brandDir, 'app-icons', 'maskable-512x512.png'))
  copyFile('black/Favicons_Emblem_only/180x180.png', path.join(brandDir, 'app-icons', 'apple-touch-icon.png'))

  const emblemTransBlack1024 = PNG.sync.read(fs.readFileSync(path.join(matteDir, 'transparent_for_black/Emblem_only/SWK_OS_Emblem_only_1024px.png')))
  const appStore1024 = composeOnCanvas(emblemTransBlack1024, 1024, 1024, [0, 0, 0], 0.84)
  fs.writeFileSync(path.join(brandDir, 'app-icons', 'app-store-1024.png'), PNG.sync.write(appStore1024))

  for (const n of [16, 32, 48, 64]) {
    copyFile(`transparent_for_black/Favicons_Emblem_only/${n}x${n}.png`, path.join(brandDir, 'favicon', `favicon-dark-${n}.png`))
    copyFile(`transparent_for_white/Favicons_Emblem_only/${n}x${n}.png`, path.join(brandDir, 'favicon', `favicon-light-${n}.png`))
  }
  copyFile('transparent_for_black/Favicons_Emblem_only/favicon.ico', path.join(brandDir, 'favicon', 'favicon.ico'))
  copyFile('transparent_for_black/Favicons_Emblem_only/favicon.ico', path.join(brandDir, 'favicon', 'favicon-dark.ico'))
  copyFile('transparent_for_white/Favicons_Emblem_only/favicon.ico', path.join(brandDir, 'favicon', 'favicon-light.ico'))

  for (const n of favSizes) {
    copyFile(`transparent_for_black/Favicons_Emblem_only/${n}x${n}.png`, path.join(brandDir, 'icons', 'transparent', `swk-icon-${n}.png`))
  }
  copyFile('transparent_for_black/Emblem_only/SWK_OS_Emblem_only_1024px.png', path.join(brandDir, 'icons', 'transparent', 'swk-icon-1024.png'))
  copyFile('transparent_for_black/Emblem_only/SWK_OS_Emblem_only_2048px.png', path.join(brandDir, 'icons', 'transparent', 'swk-icon-2048.png'))

  copyFile('transparent_for_white/Full_logo/SWK_OS_Full_logo_2048px.png', path.join(brandDir, 'masters', 'swk-primary.png'))
  copyFile('transparent_for_white/Full_logo/SWK_OS_Full_logo_2048px.png', path.join(brandDir, 'masters', 'swk-primary-approved-original.png'))
  copyFile('transparent_for_black/Full_logo/SWK_OS_Full_logo_2048px.png', path.join(brandDir, 'masters', 'swk-dark.png'))
  copyFile('transparent_for_black/Full_logo/SWK_OS_Full_logo_2048px.png', path.join(brandDir, 'masters', 'swk-dark-companion-original.png'))
  copyFile('transparent_for_black/Emblem_only/SWK_OS_Emblem_only_2048px.png', path.join(brandDir, 'masters', 'swk-icon.png'))
  copyFile('transparent_for_black/Emblem_only/SWK_OS_Emblem_only_2048px.png', path.join(brandDir, 'masters', 'swk-icon-original.png'))
  copyFile('white/Emblem_only/SWK_OS_Emblem_only_2048px.png', path.join(brandDir, 'masters', 'swk-icon-approved-white-reference.png'))
  copyFile('transparent_for_black/SWK_only/SWK_OS_SWK_only_2048px.png', path.join(brandDir, 'masters', 'swk-wordmark.png'))

  // 5b. public/brand/logos/*, wordmark/*, monochrome/*, tagline/*
  for (const w of ['240', '320', '480', '640', '960', '1280', '1600', '4096-upscaled']) {
    const srcSize = Number.parseInt(w, 10) <= 256 ? '256px' : Number.parseInt(w, 10) <= 512 ? '512px' : Number.parseInt(w, 10) <= 1024 ? '1024px' : '2048px'
    copyFile(`transparent_for_black/Full_logo/SWK_OS_Full_logo_${srcSize}.png`, path.join(brandDir, 'logos', 'dark', `swk-properties-${w}.png`))
    copyFile(`transparent_for_white/Full_logo/SWK_OS_Full_logo_${srcSize}.png`, path.join(brandDir, 'logos', 'light', `swk-properties-${w}.png`))
  }
  for (const w of ['320', '640', '1280', '1600']) {
    const srcSize = Number.parseInt(w, 10) <= 512 ? '512px' : Number.parseInt(w, 10) <= 1024 ? '1024px' : '2048px'
    copyFile(`transparent_for_black/SWK_only/SWK_OS_SWK_only_${srcSize}.png`, path.join(brandDir, 'wordmark', `swk-wordmark-${w}.png`))
  }
  copyFile('transparent_for_white/SWK_only/SWK_OS_SWK_only_1024px.png', path.join(brandDir, 'wordmark', 'swk-wordmark-black.png'))
  copyFile('transparent_for_black/SWK_only/SWK_OS_SWK_only_1024px.png', path.join(brandDir, 'wordmark', 'swk-wordmark-flat-gold.png'))
  copyFile('transparent_for_black/SWK_only/SWK_OS_SWK_only_1024px.png', path.join(brandDir, 'wordmark', 'swk-wordmark-white.png'))
  copyFile('transparent_for_white/Full_logo/SWK_OS_Full_logo_1024px.png', path.join(brandDir, 'monochrome', 'swk-properties-black.png'))
  copyFile('transparent_for_black/Full_logo/SWK_OS_Full_logo_1024px.png', path.join(brandDir, 'monochrome', 'swk-properties-flat-gold.png'))
  copyFile('transparent_for_black/Full_logo/SWK_OS_Full_logo_1024px.png', path.join(brandDir, 'monochrome', 'swk-properties-white.png'))
  copyFile('transparent_for_white/Emblem_only/SWK_OS_Emblem_only_512px.png', path.join(brandDir, 'icons', 'monochrome', 'swk-icon-black.png'))
  copyFile('transparent_for_black/Emblem_only/SWK_OS_Emblem_only_512px.png', path.join(brandDir, 'icons', 'monochrome', 'swk-icon-flat-gold.png'))
  copyFile('transparent_for_black/Emblem_only/SWK_OS_Emblem_only_512px.png', path.join(brandDir, 'icons', 'monochrome', 'swk-icon-white.png'))
  copyFile('transparent_for_black/Full_logo/SWK_OS_Full_logo_2048px.png', path.join(brandDir, 'tagline', 'swk-with-tagline-dark.png'))
  copyFile('transparent_for_white/Full_logo/SWK_OS_Full_logo_2048px.png', path.join(brandDir, 'tagline', 'swk-with-tagline-light.png'))

  // 6. OpenGraph & Social Cards (1200x630 & 1080x1080)
  const fullTransBlack1024 = PNG.sync.read(fs.readFileSync(path.join(matteDir, 'transparent_for_black/Full_logo/SWK_OS_Full_logo_1024px.png')))
  const fullTransWhite1024 = PNG.sync.read(fs.readFileSync(path.join(matteDir, 'transparent_for_white/Full_logo/SWK_OS_Full_logo_1024px.png')))
  const ogDark = composeOnCanvas(fullTransBlack1024, 1200, 630, [0, 0, 0], 0.78)
  const ogLight = composeOnCanvas(fullTransWhite1024, 1200, 630, [255, 255, 255], 0.78)
  const ogDarkBuf = PNG.sync.write(ogDark)
  fs.writeFileSync(path.join(pubDir, 'og.png'), ogDarkBuf)
  fs.writeFileSync(path.join(brandDir, 'social', 'social-card-charcoal-1200x630.png'), ogDarkBuf)
  fs.writeFileSync(path.join(brandDir, 'social', 'social-card-pearl-1200x630.png'), PNG.sync.write(ogLight))
  fs.writeFileSync(path.join(brandDir, 'social', 'avatar-charcoal-1080.png'), PNG.sync.write(composeOnCanvas(fullTransBlack1024, 1080, 1080, [0, 0, 0], 0.82)))
  fs.writeFileSync(path.join(brandDir, 'social', 'avatar-pearl-1080.png'), PNG.sync.write(composeOnCanvas(fullTransWhite1024, 1080, 1080, [255, 255, 255], 0.82)))

  // 7. assets-src root convenience copies
  copyFile('transparent_for_black/Emblem_only/SWK_OS_Emblem_only_512px.png', path.join(root, 'assets-src', 'swk-logo.png'))
  copyFile('transparent_for_black/Favicons_Emblem_only/favicon.ico', path.join(root, 'assets-src', 'SWK_favicon.ico'))
  copyFile('transparent_for_black/Favicons_Emblem_only/512x512.png', path.join(root, 'assets-src', 'SWK_favicon_512.png'))
  copyFile('transparent_for_black/Favicons_Emblem_only/512x512.png', path.join(root, 'assets-src', 'favicon.png'))

  // 8. Android App Icons, Adaptive Foreground/Monochrome, Splash Icons & Drawables
  const androidMain = path.join(root, 'android', 'app', 'src', 'main')
  const resDir = path.join(androidMain, 'res')
  if (fs.existsSync(resDir)) {
    copyFile('black/Favicons_Emblem_only/512x512.png', path.join(androidMain, 'ic_launcher-playstore.png'))

    const emblem512 = PNG.sync.read(fs.readFileSync(path.join(matteDir, 'transparent_for_black/Emblem_only/SWK_OS_Emblem_only_512px.png')))
    const full512 = PNG.sync.read(fs.readFileSync(path.join(matteDir, 'transparent_for_black/Full_logo/SWK_OS_Full_logo_512px.png')))

    const densities = [
      { name: 'mdpi', scale: 1.0, launcherFile: 'black/Favicons_Emblem_only/48x48.png' },
      { name: 'hdpi', scale: 1.5, launcherFile: 'black/Favicons_Emblem_only/128x128.png' },
      { name: 'xhdpi', scale: 2.0, launcherFile: 'black/Favicons_Emblem_only/192x192.png' },
      { name: 'xxhdpi', scale: 3.0, launcherFile: 'black/Favicons_Emblem_only/256x256.png' },
      { name: 'xxxhdpi', scale: 4.0, launcherFile: 'black/Favicons_Emblem_only/512x512.png' },
    ]

    for (const d of densities) {
      const mipDir = path.join(resDir, `mipmap-${d.name}`)
      const drawDir = path.join(resDir, `drawable-${d.name}`)
      fs.mkdirSync(mipDir, { recursive: true })
      fs.mkdirSync(drawDir, { recursive: true })

      // Legacy & round launcher icons (solid black background with Matte Gold Emblem)
      copyFile(d.launcherFile, path.join(mipDir, 'ic_launcher.png'))
      copyFile(d.launcherFile, path.join(mipDir, 'ic_launcher_round.png'))

      // Adaptive icon foreground & monochrome (108dp canvas, emblem inside 66dp safe zone -> ratio 0.58)
      const canvas = Math.round(108 * d.scale)
      const fg = composeOnCanvas(emblem512, canvas, canvas, null, 0.58)
      const mono = makeWhiteSilhouette(emblem512, canvas, canvas, 0.58)
      fs.writeFileSync(path.join(mipDir, 'ic_launcher_foreground.png'), PNG.sync.write(fg))
      fs.writeFileSync(path.join(mipDir, 'ic_launcher_monochrome.png'), PNG.sync.write(mono))

      // Status-bar notification icon (24dp white silhouette)
      const statSize = Math.round(24 * d.scale)
      const statIcon = makeWhiteSilhouette(emblem512, statSize, statSize, 0.88)
      fs.writeFileSync(path.join(drawDir, 'ic_stat_swk.png'), PNG.sync.write(statIcon))

      // Android 12+ splash icon (288dp canvas with Full Matte Gold SWK OS Logo)
      const splashSize = Math.round(288 * d.scale)
      const splashIcon = composeOnCanvas(full512, splashSize, splashSize, null, 0.52)
      fs.writeFileSync(path.join(drawDir, 'splash_icon.png'), PNG.sync.write(splashIcon))
    }

    const drawableDir = path.join(resDir, 'drawable')
    fs.mkdirSync(drawableDir, { recursive: true })
    copyFile('black/Favicons_Emblem_only/512x512.png', path.join(drawableDir, 'swk_app_icon.png'))
    copyFile('transparent_for_black/Favicons_Emblem_only/512x512.png', path.join(drawableDir, 'swk_logo.png'))
    copyFile('transparent_for_black/SWK_only/SWK_OS_SWK_only_1024px.png', path.join(drawableDir, 'swk_logo_white.png'))
    copyFile('transparent_for_white/SWK_only/SWK_OS_SWK_only_1024px.png', path.join(drawableDir, 'swk_logo_ink.png'))

    const bgXmlPath = path.join(resDir, 'values', 'ic_launcher_background.xml')
    if (fs.existsSync(path.dirname(bgXmlPath))) {
      fs.writeFileSync(bgXmlPath, `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#000000</color>\n</resources>\n`)
    }
  }

  console.log('✓ Synced Matte Gold SWK OS logos, emblems, favicons, PWA icons, OpenGraph cards, and Android icons.')
}

main()
