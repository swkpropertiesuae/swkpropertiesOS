import fs from 'node:fs'
import path from 'node:path'

/**
 * Copies the compiled web bundle (dist/web) into the Android assets so WebViewAssetLoader can serve it.
 *
 * Launcher / splash / notification icons are NOT generated here: they are committed under android/app/src/main/res
 * and produced by tools/android/generate-icons.py (exact density sizes, Lanczos from assets-src/swk-logo.png).
 */
const root = process.cwd()
const srcDir = path.join(root, 'dist', 'web')
const destDir = path.join(root, 'android', 'app', 'src', 'main', 'assets', 'public')

if (!fs.existsSync(path.join(srcDir, 'index.html'))) {
  console.error('Error: dist/web/index.html does not exist. Run "npm run build:web" first.')
  process.exit(1)
}

fs.rmSync(destDir, { recursive: true, force: true })
fs.mkdirSync(destDir, { recursive: true })
fs.cpSync(srcDir, destDir, { recursive: true })

console.log('✓ Synced SWK ONE web bundle into android/app/src/main/assets/public')
