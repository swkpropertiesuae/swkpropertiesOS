import { signInReady } from './login-ready'
import assert from 'node:assert/strict'
const base=process.env.BASE_URL??'http://127.0.0.1:8098'
async function login(email:string,password:string){const r=await signInReady(base,{email,password});assert.equal(r.status,200);return r.headers.get('set-cookie')!.split(';')[0]}
const maker=await login('admin@swkpropertiesuae.com','SWK@Admin2026'),checker=await login('manager@swkpropertiesuae.com','SWK@Manager2026')
async function api(path:string,method='GET',body?:unknown,cookie=maker,status=200){const r=await fetch(base+path,{method,headers:{'content-type':'application/json','x-swk-client':'web',cookie},body:body===undefined?undefined:JSON.stringify(body)});const data=await r.json() as any;assert.equal(r.status,status,JSON.stringify(data));return data}
const adminId=(await api('/api/e/users')).rows.find((u:any)=>u.email==='admin@swkpropertiesuae.com').id
const article=await api('/api/e/knowledge_articles','POST',{title:'API knowledge SOP',category:'SOP',owner_id:adminId,content:'Verified property documentation procedure and handover instructions. '.repeat(5)},maker,201)
await api(`/api/knowledge/${article.id}/publish`,'POST',{},maker,400);await api(`/api/knowledge/${article.id}/publish`,'POST',{},checker);await api(`/api/knowledge/${article.id}/acknowledge`,'POST');await api(`/api/knowledge/${article.id}/acknowledge`,'POST',{},maker,400)
const skill=await api('/api/e/competencies','POST',{name:'API viewing handling '+Date.now(),discipline:'Leasing',criteria:'Verify viewing and offer documentation competency'},maker,201)
const qualification=await api('/api/e/staff_qualifications','POST',{user_id:adminId,competency_id:skill.id,level:3,assessed_on:'2026-10-08',expires_on:'2099-12-31',evidence:'Reviewed assessment reference API-VIEW-001'},maker,201)
await api(`/api/qualifications/${qualification.id}/verify`,'POST',{},maker,400);await api(`/api/qualifications/${qualification.id}/verify`,'POST',{},checker);assert.ok((await api('/api/competency/matrix')).qualifications.find((q:any)=>q.id===qualification.id).current)
console.log('Enterprise API acceptance passed: reviewed knowledge articles (maker/checker publish, acknowledgement) and staff competency verification with independent approval.')
