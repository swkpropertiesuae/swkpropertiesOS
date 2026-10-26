import { signInReady } from './login-ready'
import assert from 'node:assert/strict'
import { toolPolicy } from '../src/server/ai/policy'
const base=process.env.BASE_URL??'http://127.0.0.1:8098'
async function login(email:string,password:string){const r=await signInReady(base,{email,password});assert.equal(r.status,200);return r.headers.get('set-cookie')!.split(';')[0]}
const maker=await login('admin@swkpropertiesuae.com','SWK@Admin2026'),checker=await login('manager@swkpropertiesuae.com','SWK@Manager2026')
async function api(path:string,method='GET',body?:unknown,cookie=maker,status=200){const r=await fetch(base+path,{method,headers:{'content-type':'application/json','x-swk-client':'web',cookie},body:body===undefined?undefined:JSON.stringify(body)});const data=await r.json() as any;assert.equal(r.status,status,JSON.stringify(data));return data}
const vendor=await api('/api/e/parties','POST',{name:'Controls supplier '+Date.now(),is_vendor:true},maker,201)
await api('/api/admin/settings','PUT',{bill_approval_limit:'1'})
const bill=await api('/api/e/bills','POST',{vendor_id:vendor.id,vendor_invoice_no:'CONTROL-'+Date.now(),children:{lines:[{description:'Test reviewed cost',qty:1,rate:20}]}},maker,201)
await api(`/api/finance/bills/${bill.id}/post`,'POST',{},checker,400)
await api(`/api/approvals/bills/${bill.id}/request`,'POST',{},maker)
await api(`/api/approvals/bills/${bill.id}/approve`,'POST',{},maker,400)
await api(`/api/approvals/bills/${bill.id}/approve`,'POST',{},checker)
await api(`/api/e/bills/${bill.id}`,'PUT',{notes:'Unapproved change after decision'})
assert.equal((await api(`/api/e/bills/${bill.id}`)).approval_status,'Not required')
await api(`/api/finance/bills/${bill.id}/post`,'POST',{},checker,400)
await api(`/api/approvals/bills/${bill.id}/request`,'POST',{},maker)
await api(`/api/approvals/bills/${bill.id}/approve`,'POST',{},checker)
await api(`/api/finance/bills/${bill.id}/post`,'POST',{},maker)
for(let level=0;level<3;level++) {
 assert.equal(toolPolicy('send_email','external',level),'approve')
 assert.equal(toolPolicy('post_journal','internal',level),'deny')
 assert.equal(toolPolicy('release_title_deed','internal',level),'deny')
 assert.equal(toolPolicy('submit_dld_filing','external',level),'deny')
 assert.equal(toolPolicy('new_unreviewed_tool','read',level),'deny')
}
console.log('Enterprise controls passed: bill maker/checker, approval invalidation after edits, approver posting bypass blocked, AI external approvals and prohibited/unreviewed tools.')
