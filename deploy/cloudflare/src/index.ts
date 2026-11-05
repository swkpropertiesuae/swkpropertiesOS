import { Container, getContainer } from '@cloudflare/containers'

/** Secrets and settings, set with `npx wrangler secret put NAME` (see docs/DEPLOY-CLOUDFLARE.md). */
interface Env {
  SWK_OS: DurableObjectNamespace<SwkOs>
  DATABASE_URL: string
  APP_SECRET: string
  PG_CA_CERT?: string
  ADMIN_PASSWORD: string
  MANAGER_PASSWORD: string
  BDM_PASSWORD?: string
  PUBLIC_URL?: string
  PG_SCHEMA?: string
  DEMO_ENABLED?: string
  RELEASE_SHA?: string
  RELEASE_ID?: string
}

const DEFAULT_RELEASE = 'swkproperties-os-v4'

export class SwkOs extends Container<Env> {
  defaultPort = 8080
  // Idle containers sleep; the cron trigger below keeps the active release awake.
  sleepAfter = '15m'
  enableInternet = true // needs outbound access to Supabase, e-mail, WhatsApp, etc.

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx as any, env) // the two Cloudflare type packages disagree on a generic; harmless
    this.envVars = {
      NODE_ENV: 'production',
      REQUIRE_DATABASE_URL: 'true', // the app refuses to start rather than use a throw-away local database
      TRUST_PROXY: 'true',
      COOKIE_SECURE: 'true',
      APP_TIMEZONE: 'Asia/Dubai',
      DEMO_ENABLED: env.DEMO_ENABLED ?? 'false',
      PG_SCHEMA: env.PG_SCHEMA ?? 'swk',
      DATABASE_URL: env.DATABASE_URL,
      APP_SECRET: env.APP_SECRET,
      ...(env.PG_CA_CERT ? { PG_CA_CERT: env.PG_CA_CERT } : {}), // trusted CA for the database (Supabase uses a private CA)
      ADMIN_PASSWORD: env.ADMIN_PASSWORD,
      MANAGER_PASSWORD: env.MANAGER_PASSWORD,
      ...(env.BDM_PASSWORD ? { BDM_PASSWORD: env.BDM_PASSWORD } : {}),
      ...(env.PUBLIC_URL ? { PUBLIC_URL: env.PUBLIC_URL } : {}),
    }
  }

  async ensureReleaseRunning(releaseId: string): Promise<void> {
    const runningRelease = await this.ctx.storage.get<string>('running_release_id')
    if (runningRelease && runningRelease !== releaseId) {
      await this.ctx.storage.put('running_release_id', releaseId)
      await this.ctx.storage.put('last_recycle_at', Date.now())
      try {
        await this.destroy()
      } catch {
        // ignore if already stopped
      }
      await new Promise(r => setTimeout(r, 2000))
      await this.startAndWaitForPorts({ ports: 8080, cancellationOptions: { portReadyTimeoutMS: 240_000 } })
      return
    }
    if (!runningRelease) {
      await this.ctx.storage.put('running_release_id', releaseId)
    }
    const state = await this.getState()
    if (state.status !== 'healthy') {
      await this.ctx.storage.put('last_recycle_at', Date.now())
      await this.startAndWaitForPorts({ ports: 8080, cancellationOptions: { portReadyTimeoutMS: 240_000 } })
    }
  }

  async isReleaseVerified(expectedSha: string): Promise<boolean> {
    const verified = await this.ctx.storage.get<string>('verified_image_sha')
    return verified === expectedSha
  }

  async markReleaseVerified(expectedSha: string): Promise<void> {
    await this.ctx.storage.put('verified_image_sha', expectedSha)
  }

  async recycleIfStaleImage(): Promise<boolean> {
    const lastRecycle = (await this.ctx.storage.get<number>('last_recycle_at')) ?? 0
    if (Date.now() - lastRecycle < 20_000) {
      return false
    }
    await this.ctx.storage.put('last_recycle_at', Date.now())
    try {
      await this.destroy()
    } catch {
      // ignore if already stopped
    }
    await new Promise(r => setTimeout(r, 2000))
    await this.startAndWaitForPorts({ ports: 8080, cancellationOptions: { portReadyTimeoutMS: 240_000 } })
    return true
  }
}

let legacyCleaned = false

/** Start the container for the current release if it is not up. */
async function ensureRunning(env: Env) {
  const missing = ['DATABASE_URL', 'APP_SECRET', 'ADMIN_PASSWORD', 'MANAGER_PASSWORD'].filter(k => !(env as unknown as Record<string, string | undefined>)[k])
  if (missing.length) throw new Error(`Missing secret(s): ${missing.join(', ')}. Set them with "npx wrangler secret put <NAME>".`)
  if (!legacyCleaned) {
    legacyCleaned = true
    for (const staleId of ['main', 'swk-2026-11-05-s', 'swk-2026-11-04-o', 'os-os-f47f311983ed', 'os-os-59cdae12e663']) {
      try {
        await getContainer(env.SWK_OS, staleId).destroy()
      } catch {
        // ignore if not running
      }
    }
  }
  const rawRelease = env.RELEASE_ID || env.RELEASE_SHA || DEFAULT_RELEASE
  const releaseKey = rawRelease.slice(0, 24)
  const c = getContainer(env.SWK_OS, `os-${releaseKey}`)
  await c.ensureReleaseRunning(rawRelease)
  const expectedMarker = env.RELEASE_SHA || 'swk-os-brand-pack'
  if (!(await c.isReleaseVerified(expectedMarker))) {
    const probe = await c.fetch(new Request('http://container/release.json'))
    const text = probe.ok ? await probe.text() : ''
    if (text.includes(expectedMarker)) {
      await c.markReleaseVerified(expectedMarker)
    } else {
      const recycled = await c.recycleIfStaleImage()
      if (recycled) {
        const probe2 = await c.fetch(new Request('http://container/release.json'))
        const text2 = probe2.ok ? await probe2.text() : ''
        if (text2.includes(expectedMarker)) {
          await c.markReleaseVerified(expectedMarker)
          return c
        }
      }
      throw new Error(`Container image rollout in progress (waiting for ${expectedMarker.slice(0, 12)})`)
    }
  }
  return c
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const c = await ensureRunning(env)
      const url = new URL(request.url)
      const headers = new Headers(request.headers)
      headers.set('x-forwarded-proto', url.protocol.replace(':', ''))
      headers.set('x-forwarded-host', url.host)
      const bodyBuf = ['GET', 'HEAD'].includes(request.method) ? undefined : await request.clone().arrayBuffer()
      for (let attempt = 1; attempt <= 6; attempt++) {
        try {
          const reqClone = new Request(request.url, { method: request.method, headers, body: bodyBuf })
          const res = await c.fetch(reqClone)
          if (res.status >= 500 && attempt < 6) {
            const peek = await res.clone().text().catch(() => '')
            if (peek.includes('Failed to start container') || peek.includes('not listening in the TCP address')) {
              await new Promise(r => setTimeout(r, 3000))
              await c.startAndWaitForPorts({ ports: 8080, cancellationOptions: { portReadyTimeoutMS: 240_000 } }).catch(() => {})
              continue
            }
          }
          return res
        } catch (err) {
          if (attempt >= 6) throw err
          await new Promise(r => setTimeout(r, 3000))
          await c.startAndWaitForPorts({ ports: 8080, cancellationOptions: { portReadyTimeoutMS: 240_000 } }).catch(() => {})
        }
      }
      return await c.fetch(new Request(request, { headers }))
    } catch (e) {
      return new Response('SWK OS is starting or temporarily unavailable. Please retry in a minute.\n' + (e instanceof Error ? e.message : ''), { status: 503, headers: { 'retry-after': '30' } })
    }
  },
  // Cron: make sure the app is awake so scheduled jobs (reminders, outbox, backups) keep running.
  async scheduled(_c: ScheduledController, env: Env): Promise<void> {
    const c = await ensureRunning(env)
    await c.fetch(new Request('http://container/api/health'))
  },
} satisfies ExportedHandler<Env>
