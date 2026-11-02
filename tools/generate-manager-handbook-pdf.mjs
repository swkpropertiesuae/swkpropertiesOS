import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright-core'

const REPO_DIR = 'C:/Users/Shahid/.gemini/antigravity/scratch/swkpropertiesOS'
const ARTIFACT_DIR = 'C:/Users/Shahid/.gemini/antigravity/brain/0ffbc651-4ce7-43d4-9703-d0e60c87a8c3'
const ASSETS_DIR = path.join(REPO_DIR, 'docs/handbook-assets')
const HANDBOOK_MD = path.join(REPO_DIR, 'docs/MANAGER_OPERATIONS_HANDBOOK_HASEEB.md')
const OUT_PDF_REPO = path.join(REPO_DIR, 'docs/SWK_Properties_OS_Manager_Handbook_Mohammad_Haseeb.pdf')
const OUT_PDF_ARTIFACT = path.join(ARTIFACT_DIR, 'SWK_Properties_OS_Manager_Handbook_Mohammad_Haseeb.pdf')

const CHROME_EXE = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'

function toDataUri(filePath) {
  if (!fs.existsSync(filePath)) return ''
  const ext = path.extname(filePath).toLowerCase()
  const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.svg' ? 'image/svg+xml' : 'image/png'
  return `data:${mime};base64,${fs.readFileSync(filePath).toString('base64')}`
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function formatInline(text) {
  let s = escapeHtml(text)
  s = s.replace(/\\\$/g, '$')
  s = s.replace(/\$\$\\text\{([^}]+)\}\s*=\s*\\text\{([^}]+)\}\s*-\s*\\text\{([^}]+)\}\$\$/g, '<strong>$1 = $2 − $3</strong>')
  s = s.replace(/\$\$\\text\{([^}]+)\}\s*=\s*50\\%\s*\\times\s*\\text\{([^}]+)\},\s*\\quad\s*\\text\{([^}]+)\}\s*=\s*50\\%\s*\\times\s*\\text\{([^}]+)\}\$\$/g, '<strong>$1 = 50% × $2 &nbsp;|&nbsp; $3 = 50% × $4</strong>')
  s = s.replace(/&lt;br\s*\/?&gt;/gi, '<br/>')
  s = s.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>')
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>')
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<span class="md-link">$1</span>')
  return s
}

function renderMermaidAsHtml(code) {
  if (code.includes('1. Property & Permit')) {
    const steps = [
      { n: '1', t: 'Property & Permit', s: 'Properties Dept' },
      { n: '2', t: 'Portal Ad & Lead', s: 'CRM Dept' },
      { n: '3', t: 'Viewing & Offer', s: 'SWK ONE + Sales' },
      { n: '4', t: 'Form F / SPA / Ejari', s: 'Sales or Leasing' },
      { n: '5', t: 'Cheques, NOC & Transfer', s: 'Compliance & Vault' },
      { n: '6', t: 'Invoice, 50/50 Split & VAT', s: 'Accounting & Owner' },
    ]
    return `<div class="flow-grid flow-6">${steps.map((st, idx) => `
      <div class="flow-card">
        <div class="flow-badge">STEP ${st.n}</div>
        <div class="flow-title">${escapeHtml(st.t)}</div>
        <div class="flow-sub">${escapeHtml(st.s)}</div>
        ${idx < steps.length - 1 ? '<div class="flow-arrow">→</div>' : ''}
      </div>
    `).join('')}</div>`
  }
  if (code.includes('Minute 1')) {
    const steps = [
      { b: '10:00–10:30 AM', t: 'Attendance & Roll Call', s: 'Check Reception QR scans, Live GPS viewings & Contemptor alerts' },
      { b: '10:45 AM–1:00 PM', t: 'Leads & Listings Gate', s: 'Route Bayut/Dubizzle leads & approve verified Form A listings' },
      { b: '2:00–5:30 PM', t: '3-Dept Deal Supervision', s: 'Track Off-Plan, Secondary (Form F/NOC/DLD) & Leasing (Ejari/PDC)' },
      { b: '6:30–7:00 PM', t: 'Daily Reports & Checkout', s: 'Verify all broker Daily Reports & site visits before sign-out' },
    ]
    return `<div class="flow-grid flow-4">${steps.map(st => `
      <div class="flow-card">
        <div class="flow-badge">${st.b}</div>
        <div class="flow-title">${escapeHtml(st.t)}</div>
        <div class="flow-sub">${escapeHtml(st.s)}</div>
      </div>
    `).join('')}</div>`
  }
  return `<pre class="code-block">${escapeHtml(code)}</pre>`
}

function parseMarkdownToHtml(md, imageMap) {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const out = []
  let i = 0
  let inCarousel = false
  let carouselSlides = []

  while (i < lines.length) {
    const line = lines[i]

    if (i < 8 && (line.startsWith('# SWK Properties OS') || line.startsWith('**Prepared Exclusively') || line.startsWith('**SWK Properties L.L.C') || line.startsWith('*Complete Daily Operations') || line.trim() === '---')) {
      i++
      continue
    }

    if (line.trim().startsWith('````carousel')) {
      inCarousel = true
      carouselSlides = []
      i++
      continue
    }
    if (inCarousel && line.trim().startsWith('````')) {
      inCarousel = false
      if (carouselSlides.length) {
        out.push(`<div class="shot-grid grid-2">${carouselSlides.join('')}</div>`)
      }
      i++
      continue
    }
    if (inCarousel && line.trim() === '<!-- slide -->') {
      i++
      continue
    }

    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim()
      const codeLines = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      i++
      if (lang === 'mermaid') {
        out.push(renderMermaidAsHtml(codeLines.join('\n')))
      } else {
        out.push(`<pre class="code-block">${escapeHtml(codeLines.join('\n'))}</pre>`)
      }
      continue
    }

    const imgMatch = line.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)$/)
    if (imgMatch) {
      const alt = imgMatch[1]
      const rawSrc = imgMatch[2]
      const baseName = path.basename(rawSrc)
      if (baseName.endsWith('.webm')) {
        out.push(`
          <div class="video-callout">
            <div class="video-badge">20-CHAPTER VISUAL TOUR INCLUDED BELOW</div>
            <div class="video-text">All <strong>20 high-resolution screen captures</strong> across the 12 departments you supervise daily are embedded directly throughout this handbook.</div>
          </div>
        `)
      } else {
        const dataUri = imageMap[baseName] || ''
        const cardHtml = dataUri
          ? `<figure class="shot-figure">
              <div class="shot-frame"><img src="${dataUri}" alt="${escapeHtml(alt)}" /></div>
              <figcaption>${formatInline(alt)}</figcaption>
            </figure>`
          : ''
        if (inCarousel) {
          if (cardHtml) carouselSlides.push(cardHtml)
        } else if (cardHtml) {
          out.push(cardHtml)
        }
      }
      i++
      continue
    }

    if (line.trim().startsWith('>')) {
      const qLines = []
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        qLines.push(lines[i].trim().replace(/^>\s?/, ''))
        i++
      }
      const first = qLines[0] || ''
      const alertMatch = first.match(/^\[!(IMPORTANT|NOTE|TIP|WARNING|CAUTION)\]/i)
      const kind = alertMatch ? alertMatch[1].toUpperCase() : 'NOTE'
      const bodyLines = alertMatch ? qLines.slice(1) : qLines
      out.push(`
        <div class="alert-box alert-${kind.toLowerCase()}">
          <div class="alert-title">${kind}</div>
          <div class="alert-body">${bodyLines.map(formatInline).join(' ')}</div>
        </div>
      `)
      continue
    }

    if (line.trim().startsWith('|') && i + 1 < lines.length && /^\|\s*[-:]+/.test(lines[i + 1].trim())) {
      const parseRow = (r) => r.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim())
      const headers = parseRow(lines[i])
      i += 2
      const rows = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(parseRow(lines[i]))
        i++
      }
      out.push(`
        <div class="table-wrap">
          <table>
            <thead>
              <tr>${headers.map(h => `<th>${formatInline(h)}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${rows.map(r => `<tr>${r.map(c => `<td>${formatInline(c)}</td>`).join('')}</tr>`).join('')}
            </tbody>
          </table>
        </div>
      `)
      continue
    }

    const hMatch = line.match(/^(#{1,4})\s+(.+)$/)
    if (hMatch) {
      const level = hMatch[1].length
      const text = hMatch[2].trim()
      if (text === 'Complete Guided Video Tour (All 20 Chapters)') {
        out.push(`<h2 class="sec-h2">Complete 20-Chapter Visual Screen Tour</h2>`)
      } else if (level === 2 && text.startsWith('Part ')) {
        out.push(`<div class="part-break"></div><h2 class="part-heading">${formatInline(text)}</h2>`)
      } else if (level === 3 && text.startsWith('Department ')) {
        out.push(`<div class="dept-break"></div><h3 class="dept-heading">${formatInline(text)}</h3>`)
      } else {
        out.push(`<h${level} class="sec-h${level}">${formatInline(text)}</h${level}>`)
      }
      i++
      continue
    }

    if (line.trim() === '---') {
      out.push('<hr class="sec-hr" />')
      i++
      continue
    }

    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const isOrdered = /^\s*\d+\.\s+/.test(line)
      const tag = isOrdered ? 'ol' : 'ul'
      const items = []
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        const itemText = lines[i].replace(/^\s*([-*]|\d+\.)\s+/, '').trim()
        const subItems = []
        i++
        while (i < lines.length && /^\s{2,}([-*]|\d+\.)\s+/.test(lines[i])) {
          subItems.push(lines[i].replace(/^\s+([-*]|\d+\.)\s+/, '').trim())
          i++
        }
        items.push(`<li>${formatInline(itemText)}${subItems.length ? `<ul>${subItems.map(s => `<li>${formatInline(s)}</li>`).join('')}</ul>` : ''}</li>`)
      }
      out.push(`<${tag} class="md-list">${items.join('')}</${tag}>`)
      continue
    }

    if (!line.trim()) {
      i++
      continue
    }

    const pLines = []
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith('#') &&
      !lines[i].trim().startsWith('|') &&
      !lines[i].trim().startsWith('>') &&
      !lines[i].trim().startsWith('```') &&
      !lines[i].trim().startsWith('![') &&
      lines[i].trim() !== '---' &&
      !/^\s*([-*]|\d+\.)\s+/.test(lines[i])
    ) {
      pLines.push(lines[i].trim())
      i++
    }
    if (pLines.length) {
      out.push(`<p class="md-p">${pLines.map(formatInline).join(' ')}</p>`)
    } else {
      i++
    }
  }

  return out.join('\n')
}

async function main() {
  const imageMap = {}
  for (const f of fs.readdirSync(ASSETS_DIR).filter(x => x.endsWith('.png'))) {
    imageMap[f] = toDataUri(path.join(ASSETS_DIR, f))
  }

  const logoWhiteUri = toDataUri(path.join(REPO_DIR, 'public/brand/swk-logo-white.png'))
  const studioGoldUri = toDataUri(path.join(REPO_DIR, 'assets-src/SWK_Studio_Logo_Gold.jpg'))

  const mdContent = fs.readFileSync(HANDBOOK_MD, 'utf8')
  const bodyHtml = parseMarkdownToHtml(mdContent, imageMap)

  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>SWK Properties OS — Operations Manager’s Master Handbook (Mohammad Haseeb)</title>
  <style>
    @page {
      size: A4;
      margin: 18mm 14mm 18mm 14mm;
    }
    * { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
      color: #101A2B;
      background: #FFFFFF;
      line-height: 1.52;
      font-size: 9.8pt;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .cover-page {
      background: linear-gradient(155deg, #071120 0%, #0B192E 58%, #132544 100%);
      color: #F8F4EC;
      border-radius: 14px;
      padding: 40px 38px;
      min-height: 256mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      border: 1.5px solid rgba(200, 162, 74, 0.45);
      page-break-after: always;
    }
    .cover-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid rgba(200, 162, 74, 0.28);
      padding-bottom: 22px;
    }
    .cover-logo {
      height: 62px;
      object-fit: contain;
    }
    .cover-orn-badge {
      background: rgba(200, 162, 74, 0.16);
      border: 1px solid rgba(200, 162, 74, 0.55);
      color: #E5C77B;
      padding: 7px 14px;
      border-radius: 999px;
      font-size: 8.5pt;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .cover-hero {
      margin: 30px 0 22px 0;
    }
    .cover-kicker {
      color: #D8B568;
      font-size: 9.5pt;
      font-weight: 700;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      margin-bottom: 10px;
    }
    .cover-title {
      font-size: 25pt;
      font-weight: 800;
      line-height: 1.15;
      color: #FFFFFF;
      margin: 0 0 14px 0;
      letter-spacing: -0.02em;
    }
    .cover-subtitle {
      font-size: 11pt;
      color: #CBD5E1;
      max-width: 94%;
      line-height: 1.55;
      margin: 0 0 20px 0;
    }
    .cover-studio-preview {
      display: grid;
      grid-template-columns: 1.25fr 1fr;
      gap: 14px;
      margin: 16px 0;
    }
    .cover-studio-card {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(200, 162, 74, 0.32);
      border-radius: 10px;
      padding: 10px;
      text-align: center;
    }
    .cover-studio-card img {
      width: 100%;
      height: 145px;
      object-fit: cover;
      border-radius: 6px;
    }
    .cover-studio-caption {
      font-size: 7.8pt;
      color: #D8B568;
      margin-top: 6px;
      font-weight: 600;
      letter-spacing: 0.04em;
    }
    .cover-stats {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-top: 16px;
    }
    .cover-stat {
      background: rgba(15, 28, 51, 0.85);
      border: 1px solid rgba(200, 162, 74, 0.35);
      border-radius: 9px;
      padding: 11px 12px;
    }
    .cover-stat-val {
      font-size: 12.5pt;
      font-weight: 800;
      color: #E8C97A;
    }
    .cover-stat-lbl {
      font-size: 7.4pt;
      color: #94A3B8;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-top: 3px;
    }
    .cover-footer {
      border-top: 1px solid rgba(200, 162, 74, 0.28);
      padding-top: 16px;
      display: flex;
      justify-content: space-between;
      font-size: 8.5pt;
      color: #94A3B8;
    }
    .part-break {
      page-break-before: always;
    }
    .part-heading {
      background: linear-gradient(90deg, #091526 0%, #162B4D 100%);
      color: #F8F4EC;
      padding: 12px 16px;
      border-left: 5px solid #C8A24A;
      border-radius: 7px;
      font-size: 14.5pt;
      font-weight: 800;
      margin: 0 0 14px 0;
      letter-spacing: -0.01em;
    }
    .dept-heading {
      background: #F4EFE6;
      color: #0B192E;
      padding: 9px 14px;
      border-left: 4px solid #0B192E;
      border-radius: 6px;
      font-size: 12pt;
      font-weight: 800;
      margin: 18px 0 10px 0;
      page-break-after: avoid;
    }
    .sec-h2 {
      font-size: 13pt;
      font-weight: 800;
      color: #0B192E;
      border-bottom: 2px solid #C8A24A;
      padding-bottom: 5px;
      margin: 16px 0 10px 0;
      page-break-after: avoid;
    }
    .sec-h3 {
      font-size: 11pt;
      font-weight: 700;
      color: #0F2342;
      margin: 14px 0 6px 0;
      page-break-after: avoid;
    }
    .sec-h4 {
      font-size: 9.8pt;
      font-weight: 700;
      color: #7C5E1A;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin: 10px 0 6px 0;
      page-break-after: avoid;
    }
    .sec-hr {
      border: 0;
      border-top: 1px solid #E2E8F0;
      margin: 14px 0;
    }
    .md-p {
      margin: 6px 0 9px 0;
      color: #1E293B;
    }
    .md-list {
      margin: 6px 0 10px 0;
      padding-left: 20px;
    }
    .md-list li {
      margin-bottom: 4px;
      color: #1E293B;
    }
    code {
      font-family: Consolas, 'Courier New', monospace;
      background: #F1F5F9;
      color: #0F172A;
      padding: 1px 5px;
      border-radius: 4px;
      font-size: 8.6pt;
      border: 1px solid #E2E8F0;
    }
    .md-link {
      color: #0B192E;
      font-weight: 600;
      text-decoration: none;
    }
    .table-wrap {
      margin: 10px 0 14px 0;
      page-break-inside: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.6pt;
    }
    thead {
      display: table-header-group;
    }
    tr {
      page-break-inside: avoid;
    }
    th {
      background: #0B192E;
      color: #F8F4EC;
      font-weight: 700;
      text-align: left;
      padding: 7px 9px;
      border: 1px solid #1E3356;
    }
    td {
      padding: 6.5px 9px;
      border: 1px solid #CBD5E1;
      vertical-align: top;
      color: #1E293B;
    }
    tbody tr:nth-child(even) td {
      background: #F8FAFC;
    }
    .shot-figure {
      margin: 10px 0 14px 0;
      page-break-inside: avoid;
      background: #F8FAFC;
      border: 1px solid #CBD5E1;
      border-radius: 8px;
      padding: 7px;
    }
    .shot-frame img {
      width: 100%;
      max-height: 290px;
      object-fit: contain;
      border-radius: 5px;
      border: 1px solid #E2E8F0;
      display: block;
      background: #0B192E;
    }
    .shot-figure figcaption {
      font-size: 8.2pt;
      font-weight: 700;
      color: #334155;
      text-align: center;
      margin-top: 5px;
    }
    .shot-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin: 10px 0 14px 0;
      page-break-inside: avoid;
    }
    .shot-grid .shot-figure {
      margin: 0;
    }
    .shot-grid .shot-frame img {
      max-height: 195px;
    }
    .flow-grid {
      display: grid;
      gap: 8px;
      margin: 10px 0 14px 0;
      page-break-inside: avoid;
    }
    .flow-6 { grid-template-columns: repeat(6, 1fr); }
    .flow-4 { grid-template-columns: repeat(4, 1fr); }
    .flow-card {
      background: #0B192E;
      color: #FFFFFF;
      border: 1px solid #C8A24A;
      border-radius: 7px;
      padding: 8px 9px;
      position: relative;
    }
    .flow-badge {
      font-size: 7pt;
      font-weight: 800;
      color: #E8C97A;
      letter-spacing: 0.08em;
      margin-bottom: 3px;
    }
    .flow-title {
      font-size: 8.3pt;
      font-weight: 700;
      line-height: 1.25;
      margin-bottom: 3px;
    }
    .flow-sub {
      font-size: 7.4pt;
      color: #CBD5E1;
      line-height: 1.25;
    }
    .flow-arrow {
      position: absolute;
      right: -7px;
      top: 50%;
      transform: translateY(-50%);
      background: #C8A24A;
      color: #0B192E;
      font-weight: 900;
      font-size: 7.5pt;
      width: 13px;
      height: 13px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2;
    }
    .alert-box {
      border-left: 4px solid #C8A24A;
      background: #FBF8F1;
      border-radius: 6px;
      padding: 9px 12px;
      margin: 10px 0 12px 0;
      page-break-inside: avoid;
    }
    .alert-title {
      font-size: 8pt;
      font-weight: 800;
      color: #8A6518;
      letter-spacing: 0.08em;
      margin-bottom: 3px;
    }
    .alert-body {
      font-size: 9pt;
      color: #1E293B;
    }
    .video-callout {
      background: linear-gradient(90deg, #0B192E 0%, #172E52 100%);
      color: #F8F4EC;
      border-left: 4px solid #C8A24A;
      border-radius: 7px;
      padding: 10px 14px;
      margin: 10px 0 14px 0;
    }
    .video-badge {
      color: #E8C97A;
      font-size: 7.8pt;
      font-weight: 800;
      letter-spacing: 0.08em;
      margin-bottom: 3px;
    }
    .video-text {
      font-size: 9pt;
      color: #E2E8F0;
    }
  </style>
</head>
<body>
  <div class="cover-page">
    <div>
      <div class="cover-top">
        <img class="cover-logo" src="${logoWhiteUri}" alt="SWK Properties" />
        <div class="cover-orn-badge">Operations Manager Edition · RERA ORN 51517</div>
      </div>
      <div class="cover-hero">
        <div class="cover-kicker">Role-Specific Operations &amp; Governance Manual</div>
        <h1 class="cover-title">SWK Properties OS<br/>Operations Manager’s Master Handbook</h1>
        <p class="cover-subtitle">
          Prepared exclusively for <strong>Mohammad Haseeb (Operations Manager)</strong>. Complete step-by-step playbook for running daily brokerage operations across <strong>Off-Plan Sales</strong>, <strong>Secondary Sales</strong>, and <strong>Leasing</strong>, supervising the <code>10:00 AM – 7:00 PM</code> attendance &amp; Checkout Gate, enforcing legal UAE payments &amp; 50/50 + A2A commission splits, and routing administrative decisions, deletions &amp; refunds to <strong>Owner Shabib Siraj</strong>.
        </p>
      </div>
      <div class="cover-studio-preview">
        <div class="cover-studio-card">
          <img src="${imageMap['hb-04-daily-operations.png']}" alt="Daily Operations Control Centre" />
          <div class="cover-studio-caption">Daily Operations Control Centre (Step 6)</div>
        </div>
        <div class="cover-studio-card">
          <img src="${studioGoldUri || imageMap['hb-03-dashboard-overview.png']}" alt="SWK Properties Identity" />
          <div class="cover-studio-caption">SWK Properties L.L.C · Dubai, UAE</div>
        </div>
      </div>
      <div class="cover-stats">
        <div class="cover-stat">
          <div class="cover-stat-val">3 Core Depts</div>
          <div class="cover-stat-lbl">Off-Plan · Secondary · Leasing</div>
        </div>
        <div class="cover-stat">
          <div class="cover-stat-val">10am – 7pm</div>
          <div class="cover-stat-lbl">10:05 Grace &amp; Checkout Gate</div>
        </div>
        <div class="cover-stat">
          <div class="cover-stat-val">50/50 + A2A</div>
          <div class="cover-stat-lbl">Legal UAE Payments Only</div>
        </div>
        <div class="cover-stat">
          <div class="cover-stat-val">Owner Gate</div>
          <div class="cover-stat-lbl">Admin, Bin &amp; Refund Escalation</div>
        </div>
      </div>
    </div>
    <div class="cover-footer">
      <div><strong>Account Holder:</strong> Mohammad Haseeb (<code>manager@swkpropertiesuae.com</code>)</div>
      <div><strong>Reporting To:</strong> Shabib Siraj (Owner &amp; Managing Director)</div>
    </div>
  </div>

  ${bodyHtml}
</body>
</html>`

  console.log('1. Launching Chrome to render Operations Manager Handbook PDF...')
  const browser = await chromium.launch({ executablePath: CHROME_EXE, headless: true, args: ['--no-sandbox'] })
  const pdfPage = await browser.newPage()
  await pdfPage.setContent(fullHtml, { waitUntil: 'load' })
  await pdfPage.waitForTimeout(500)

  await pdfPage.pdf({
    path: OUT_PDF_REPO,
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: `<div style="width:100%;font-size:7.5pt;font-family:'Segoe UI',sans-serif;color:#64748B;padding:0 13mm;display:flex;justify-content:space-between;"><span>SWK Properties L.L.C · Operations Manager Handbook (Mohammad Haseeb)</span><span>Reporting to Owner Shabib Siraj · RERA ORN 51517</span></div>`,
    footerTemplate: `<div style="width:100%;font-size:7.5pt;font-family:'Segoe UI',sans-serif;color:#64748B;padding:0 13mm;display:flex;justify-content:space-between;"><span>Confidential · SWK Properties L.L.C Internal Operations Manual</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`,
    margin: { top: '16mm', bottom: '16mm', left: '13mm', right: '13mm' },
  })

  fs.copyFileSync(OUT_PDF_REPO, OUT_PDF_ARTIFACT)
  const sizeMb = (fs.statSync(OUT_PDF_REPO).size / 1024 / 1024).toFixed(2)
  console.log(`2. Successfully generated Manager Handbook PDF! Size: ${sizeMb} MB`)
  console.log(`   - Repo:     ${OUT_PDF_REPO}`)
  console.log(`   - Artifact: ${OUT_PDF_ARTIFACT}`)
  await browser.close()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
