# Install SWK OS as an app

SWK OS is an installable web app (PWA). It opens in its own window with a home-screen icon. It is the same app as the website, so updates arrive without any store.

## How to install

| Device | Steps |
|---|---|
| Windows / Mac / Linux (Chrome, Edge) | Open the site, then use **Install app** in the account menu (top right), or the install icon in the address bar. |
| Android (Chrome) | Open the site, then **Install app** in the account menu, or the browser menu → **Install app**. |
| iPhone / iPad (Safari) | Tap **Share** → **Add to Home Screen**. (Safari offers no install button, so the account menu shows a reminder.) |

## What works offline

Nothing that needs your data. Without a network the app shows an "offline" page and a **Try again** button. **API responses and pages are never stored on the device**, because they hold private client and financial data and are tied to a login. Only public files are cached: scripts, styles, fonts and logos.

## Updates

When a new version is released, a banner says **A new version of SWK OS is ready** with a **Reload** button. The app does not reload by itself, so a form you are filling in is never lost.

## For developers

- `public/manifest.webmanifest` – name, icons (any and maskable), shortcuts.
- `public/sw.js` – service worker. The build stamps a build id into it (`vite.config.ts`), so each release uses new caches and old ones are removed.
- `public/offline.html` – offline page (no scripts, to fit the strict CSP).
- `src/web/lib/pwa.ts` – registration, install prompt and update state. The worker is only registered in production builds.
- Tests: `tests/pwa.ts` (served files and rules), `tests/pwa-ui.mjs` (real browser: install check, offline page, no private data cached).

## Not included

- Offline use of business data (needs encrypted storage and a conflict policy, so it is a separate project).
- Push notifications.
- Store apps (Google Play, App Store) and a desktop installer. These can wrap this same web app later.
