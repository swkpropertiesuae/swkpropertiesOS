import type { FastifyInstance } from 'fastify'
import { inDemo } from '../db'
import { bad } from '../util'
import { config } from '../config'
import { resetDemoWorkspace, getDemoDb } from '../demo/workspace'

export default async function (app: FastifyInstance) {
  app.get('/api/demo/status', async () => ({ enabled: config.demo.enabled && !!getDemoDb(), email: config.demo.enabled ? config.demo.email : '' }))
  app.post('/api/demo/reset', async (req, reply) => {
    if (!inDemo()) throw bad('Only available in the demo workspace')
    setImmediate(() => { try { void Promise.resolve(resetDemoWorkspace()).catch(e => console.error('demo reset', e)) } catch (e) { console.error('demo reset', e) } })
    reply.clearCookie('SWK_sid', { path: '/' })
    return { ok: true }
  })
}
