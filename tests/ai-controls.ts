import assert from 'node:assert/strict'
import { syncSchema } from '../src/server/schema'
import { seedReference } from '../src/server/seed'
import { q } from '../src/server/db'
import { createRecord, getDef, insertRow, SYSTEM_CTX } from '../src/server/engine'
import { decideAction } from '../src/server/ai/agents'
import { toolByName, TOOLS } from '../src/server/ai/tools'
import { toolPolicy } from '../src/server/ai/policy'
import { AGENT_TEMPLATES } from '../src/server/ai/templates'
syncSchema();seedReference()
const agent=createRecord(getDef('ai_agents'),{name:'Race-test agent',instructions:'Exercise deterministic approval concurrency controls',tools:'create_task',autonomy:'Autopilot (act, then report)',active:false},SYSTEM_CTX)
const tool=toolByName('create_task')!,original=tool.run
let calls=0,release!:()=>void
const waiting=new Promise<void>(r=>release=r)
tool.run=async()=>{calls++;await waiting;return {ok:true}}
try {
 const id=insertRow(getDef('ai_actions'),{agent_id:agent.id,tool:'create_task',args:{title:'Concurrency test'},status:'Pending',summary:'One execution',created:'2026-10-08T12:00'})
 const first=decideAction(id,true,1)
 await assert.rejects(decideAction(id,true,2),/Already executing|already been claimed/)
 assert.equal(calls,1);release();assert.equal((await first).status,'Executed')
 await assert.rejects(decideAction(id,true,1),/Already executed/)
 const revoked=insertRow(getDef('ai_actions'),{agent_id:agent.id,tool:'create_task',args:{title:'Revoked'},status:'Pending',summary:'Revoked capability',created:'2026-10-08T12:00'})
 q.run(`UPDATE ai_agents SET tools='search_jobs' WHERE id=?`,agent.id)
 assert.equal((await decideAction(revoked,true,1)).status,'Failed');assert.equal(calls,1)
 const prohibited=insertRow(getDef('ai_actions'),{agent_id:agent.id,tool:'post_journal',args:{},status:'Pending',summary:'Prohibited capability',created:'2026-10-08T12:00'})
 assert.equal((await decideAction(prohibited,true,1)).status,'Failed');assert.equal(calls,1)
 // every shipped tool must be reviewed in the policy (a name missing there is silently denied) and must really run
 const names=new Set(TOOLS.map(t=>t.name))
 for(const t of TOOLS)assert.notEqual(toolPolicy(t.name,t.risk,2),'deny',`${t.name} is not listed in ai/policy.ts, so every agent would be refused it`)
 for(const t of TOOLS.filter(x=>x.risk==='read')){try{await t.run({},{agent:'check'})}catch(e:any){assert.fail(`read tool ${t.name} throws when run: ${e.message}`)}}
 // templates may only use, and tell the model to call, tools that exist
 for(const tpl of AGENT_TEMPLATES){
  for(const n of tpl.tools.split(',').map(x=>x.trim()))assert.ok(names.has(n),`template "${tpl.key}" lists unknown tool ${n}`)
  for(const m of tpl.instructions.matchAll(/\b(?:[Cc]all|using|use|via)\s+([a-z]+_[a-z_]+)/g))assert.ok(names.has(m[1]),`template "${tpl.key}" tells the model to use unknown tool ${m[1]}`)
 }
 console.log('AI controls passed: one execution under simultaneous decisions, repeat blocked, revoked and prohibited capabilities blocked; every tool is policy-listed and runs; templates only use real tools.')
}finally{tool.run=original}
