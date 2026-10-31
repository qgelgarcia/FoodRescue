import assert from 'node:assert/strict';import {test,before,after} from 'node:test';import {readFile,mkdir,mkdtemp,rm} from 'node:fs/promises';import path from 'node:path';import {pathToFileURL} from 'node:url';import {PGlite} from '@electric-sql/pglite';import {build} from 'esbuild';import React from 'react';import Renderer,{act} from 'react-test-renderer';
const alice='10000000-0000-4000-8000-000000000001';const bob='10000000-0000-4000-8000-000000000002';let db;
before(async()=>{db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema public,auth to authenticated,service_role;
create table public.profiles(id uuid primary key);insert into public.profiles values('${alice}'),('${bob}');
create table public.email_preferences(user_id uuid primary key,claims_enabled boolean,receipts_enabled boolean);
create table public.email_outbox(id uuid default gen_random_uuid(),user_id uuid,state text default 'pending',finished_at timestamptz,lease_id uuid,lease_until timestamptz);
create function public.claim_email_jobs(integer default 5) returns setof public.email_outbox language sql security definer as $$ select * from public.email_outbox where state='pending' $$;
grant execute on function public.claim_email_jobs(integer) to service_role;`);await db.exec(await readFile('supabase/migrations/20261031040000_terms_acceptance.sql','utf8'));});
after(async()=>await db?.close());
async function asUser(id,fn){await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);try{return await fn();}finally{await db.exec('reset role');}}
test('acceptance is current-version, owner-only, timestamped, and cannot be forged through direct writes',async()=>{
 await assert.rejects(asUser(alice,()=>db.query("select public.accept_current_terms('old',false)")),/current terms version/i);
 await assert.rejects(asUser(alice,()=>db.query('insert into public.terms_acceptances(user_id,terms_version) values($1,$2)',[bob,'2026-10-31.1'])),/permission denied/i);
 const row=(await asUser(alice,()=>db.query("select public.accept_current_terms('2026-10-31.1',false) accepted"))).rows[0].accepted;
 assert.equal(row.user_id,alice);assert.equal(row.terms_version,'2026-10-31.1');assert.ok(row.accepted_at);
 assert.equal((await asUser(bob,()=>db.query('select * from public.terms_acceptances'))).rows.length,0);
 assert.equal((await db.query('select claims_enabled from public.email_preferences where user_id=$1',[alice])).rows[0].claims_enabled,false);
 await db.query('update public.email_preferences set claims_enabled=true where user_id=$1',[alice]);
 await asUser(alice,()=>db.query("select public.accept_current_terms('2026-10-31.1',false)"));
 assert.equal((await db.query('select claims_enabled from public.email_preferences where user_id=$1',[alice])).rows[0].claims_enabled,true);
});
test('service delivery cannot bypass acceptance or call the old unrestricted lease function',async()=>{
 await db.query('insert into public.email_outbox(user_id) values($1),($2)',[alice,bob]);
 await db.exec('set role service_role');
 try{await assert.rejects(db.query('select * from public.claim_email_jobs_before_consent(5)'),/permission denied/i);const jobs=(await db.query('select * from public.claim_email_jobs(5)')).rows;assert.equal(jobs.length,1);assert.equal(jobs[0].user_id,alice);}finally{await db.exec('reset role');}
 assert.equal((await db.query('select state from public.email_outbox where user_id=$1',[bob])).rows[0].state,'skipped');
});

await mkdir('output',{recursive:true});const root=path.resolve('output');const directory=await mkdtemp(path.join(root,'terms-test-'));const file=path.join(directory,'gate.mjs');
await build({entryPoints:['apps/frontend/src/components/privacy/TermsGate.jsx'],outfile:file,bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'silent',plugins:[{name:'fixtures',setup(b){
 b.onResolve({filter:/^react$/,namespace:'fixture'},()=>({path:'react',external:true}));
 b.onResolve({filter:/\.css$/},()=>({path:'css',namespace:'fixture'}));
 b.onResolve({filter:/services\/terms$/},()=>({path:'terms',namespace:'fixture'}));b.onResolve({filter:/services\/auth$/},()=>({path:'auth',namespace:'fixture'}));b.onResolve({filter:/LoadingState$/},()=>({path:'loading',namespace:'fixture'}));b.onResolve({filter:/^react-router-dom$/},()=>({path:'router',namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},({path:p})=>({contents:p==='css'?'':p==='terms'?`export const TERMS_VERSION='2026-10-31.1';export const getTermsAcceptance=(id)=>globalThis.termsFixture.read(id);export const acceptTerms=(id,email)=>globalThis.termsFixture.accept(id,email);`:p==='auth'?`export const logout=async()=>{};`:p==='router'?`export const useHistory=()=>({replace(){}});`:`import React from 'react';export default ()=>React.createElement('div',{role:'status'},'Loading');`,loader:'js'}));
}}]});const {default:Gate}=await import(pathToFileURL(file));after(async()=>{delete globalThis.termsFixture;if(path.dirname(directory)!==root)throw new Error('Invalid cleanup path');await rm(directory,{recursive:true,force:true});});
function text(renderer){return JSON.stringify(renderer.toJSON());}
test('main content waits for acceptance; unchecked agreement and failed save cannot unlock it',async()=>{
 let calls=0;globalThis.termsFixture={read:async()=>null,accept:async()=>{calls++;throw new Error('Save failed');}};let view;
 await act(async()=>{view=Renderer.create(React.createElement(Gate,{userId:alice},React.createElement('div',null,'PRIVATE MAIN CONTENT')));});
 assert.doesNotMatch(text(view),/PRIVATE MAIN CONTENT/);assert.equal(view.root.findAllByType('input').length,2);
 await act(async()=>view.root.findByType('form').props.onSubmit({preventDefault(){}}));assert.equal(calls,0);
 act(()=>view.root.findAllByType('input')[0].props.onChange({target:{checked:true}}));
 await act(async()=>view.root.findByType('form').props.onSubmit({preventDefault(){}}));assert.equal(calls,1);assert.match(text(view),/Save failed/);assert.doesNotMatch(text(view),/PRIVATE MAIN CONTENT/);
 globalThis.termsFixture.accept=async(id,email)=>{assert.equal(id,alice);assert.equal(email,false);return {};};
 await act(async()=>view.root.findByType('form').props.onSubmit({preventDefault(){}}));assert.match(text(view),/PRIVATE MAIN CONTENT/);act(()=>view.unmount());
});
test('read failures fail closed and changing accounts rejects late responses',async()=>{
 let resolve;globalThis.termsFixture={read:id=>id===alice?new Promise(r=>{resolve=r;}):Promise.reject(new Error('Session changed')),accept:async()=>{}};let view;
 await act(async()=>{view=Renderer.create(React.createElement(Gate,{userId:alice},React.createElement('div',null,'PRIVATE MAIN CONTENT')));});
 await act(async()=>view.update(React.createElement(Gate,{userId:bob},React.createElement('div',null,'PRIVATE MAIN CONTENT'))));
 await act(async()=>resolve({accepted_at:'now'}));assert.doesNotMatch(text(view),/PRIVATE MAIN CONTENT/);act(()=>view.unmount());
});
