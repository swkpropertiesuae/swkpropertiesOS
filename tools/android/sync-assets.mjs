import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const srcDir = path.join(root, 'dist', 'web')
const destDir = path.join(root, 'android', 'app', 'src', 'main', 'assets', 'public')
const resDir = path.join(root, 'android', 'app', 'src', 'main', 'res')

if (!fs.existsSync(srcDir)) {
  console.error('Error: dist/web does not exist. Run "npm run build:web" first.')
  process.exit(1)
}

// 1. Copy compiled web bundle into Android assets/public
fs.rmSync(destDir, { recursive: true, force: true })
fs.mkdirSync(destDir, { recursive: true })
fs.cpSync(srcDir, destDir, { recursive: true })

// 2. Copy official SWK Properties brand icons & logos into Android res/mipmap-* and res/drawable
const mipmapMap = [
  { folder: 'mipmap-mdpi', src: path.join(root, 'public', 'favicon', 'favicon-48.png') },
  { folder: 'mipmap-hdpi', src: path.join(root, 'public', 'favicon', 'favicon-128.png') },
  { folder: 'mipmap-xhdpi', src: path.join(root, 'public', 'favicon', 'favicon-192.png') },
  { folder: 'mipmap-xxhdpi', src: path.join(root, 'public', 'favicon', 'favicon-256.png') },
  { folder: 'mipmap-xxxhdpi', src: path.join(root, 'public', 'app-icon-512.png') },
]

for (const item of mipmapMap) {
  const targetDir = path.join(resDir, item.folder)
  fs.mkdirSync(targetDir, { recursive: true })
  if (fs.existsSync(item.src)) {
    fs.copyFileSync(item.src, path.join(targetDir, 'ic_launcher.png'))
    fs.copyFileSync(item.src, path.join(targetDir, 'ic_launcher_round.png'))
  }
}

const drawableDir = path.join(resDir, 'drawable')
fs.mkdirSync(drawableDir, { recursive: true })
const brandDrawables = [
  { src: path.join(root, 'public', 'brand', 'swk-logo-white.png'), dest: 'swk_logo_white.png' },
  { src: path.join(root, 'public', 'brand', 'swk-logo-ink.png'), dest: 'swk_logo_ink.png' },
  { src: path.join(root, 'public', 'brand', 'swk-logo.png'), dest: 'swk_logo.png' },
  { src: path.join(root, 'public', 'app-icon-512.png'), dest: 'swk_app_icon.png' },
]
for (const d of brandDrawables) {
  if (fs.existsSync(d.src)) {
    fs.copyFileSync(d.src, path.join(drawableDir, d.dest))
  }
}

console.log('✓ Synced SWK ONE production bundle & official SWK Properties brand icons into android/app/src/main/')
