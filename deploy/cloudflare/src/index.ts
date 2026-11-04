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
}

const INSTANCE = 'main' // one instance only – the app holds a single database connection and runs its own scheduler
const DEFAULT_RELEASE = '2026-11-04-reception-qr-v1'

export class SwkOs extends Container<Env> {
  defaultPort = 8080
  // Idle containers sleep; the cron trigger below keeps this one awake, so it is effectively always on.
  sleepAfter = '1h'
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
    if (runningRelease !== releaseId) {
      await this.ctx.storage.put('running_release_id', releaseId)
      try {
        await this.destroy()
      } catch {
        // ignore if already stopped
      }
      await new Promise(r => setTimeout(r, 2500))
      await this.startAndWaitForPorts({ ports: 8080, cancellationOptions: { portReadyTimeoutMS: 240_000 } })
      return
    }
    const state = await this.getState()
    if (state.status !== 'healthy') {
      await this.startAndWaitForPorts({ ports: 8080, cancellationOptions: { portReadyTimeoutMS: 240_000 } })
    }
  }
}

/** Start the container if it is not up (or roll it over when a new release image is deployed). */
async function ensureRunning(env: Env) {
  const missing = ['DATABASE_URL', 'APP_SECRET', 'ADMIN_PASSWORD', 'MANAGER_PASSWORD'].filter(k => !(env as unknown as Record<string, string | undefined>)[k])
  if (missing.length) throw new Error(`Missing secret(s): ${missing.join(', ')}. Set them with "npx wrangler secret put <NAME>".`)
  const c = getContainer(env.SWK_OS, INSTANCE)
  await c.ensureReleaseRunning(env.RELEASE_SHA || DEFAULT_RELEASE)
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
