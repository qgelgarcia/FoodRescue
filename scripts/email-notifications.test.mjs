import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { build } from 'esbuild';
const donor='10000000-0000-4000-8000-000000000001';
const member='10000000-0000-4000-8000-000000000002';
const outsider='10000000-0000-4000-8000-000000000003';
const post='20000000-0000-4000-8000-000000000001';
const claim='30000000-0000-4000-8000-000000000001';
let db;
before(async()=>{
  db=new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin;create role service_role nologin bypassrls;
    create schema auth;create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to authenticated,service_role;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create table public.profiles(id uuid primary key,status text,full_name text);
    create table public.food_posts(id uuid primary key,donor_id uuid,food_name text,pickup_address text,pickup_lat numeric,pickup_lng numeric,expires_at timestamptz,status text,quantity_remaining integer);
    create table public.claims(id uuid primary key,post_id uuid,claimant_id uuid,quantity_claimed integer,status text,claimed_at timestamptz default now(),updated_at timestamptz default now());
    insert into public.profiles values('${donor}','active','Donor'),('${member}','active','Recipient'),('${outsider}','active','Outside');
    insert into auth.users values('${donor}','donor@example.test',now()),('${member}','member@example.test',now()),('${outsider}','outside@example.test',null);`);
  await db.exec(await readFile('supabase/migrations/20261031010000_email_notifications.sql','utf8'));
});
after(async()=>await db?.close());
async function actor(id,fn){await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);try{return await fn();}finally{await db.exec('reset role');}}
async function reset(){await db.exec('truncate public.email_outbox,public.email_preferences,public.claims,public.food_posts cascade');}
async function createPost(id=post,lat=14.6,lng=121){await db.query("insert into public.food_posts values($1,$2,'Rice bowl','Campus gate',$3,$4,now()+interval '1 hour','active',5)",[id,donor,lat,lng]);}
async function createClaim(){await db.query("insert into public.claims(id,post_id,claimant_id,quantity_claimed,status) values($1,$2,$3,2,'pending')",[claim,post,member]);}

test('claims queue both participants; receipts only follow verified picked-up status',async()=>{
 await reset();await createPost();await createClaim();
 let rows=(await db.query('select * from public.email_outbox')).rows;assert.equal(rows.length,2);assert.ok(rows.every(r=>r.kind==='claim'));assert.equal(rows.find(r=>r.user_id===donor).payload.claimantName,'Recipient');
 await db.query("update public.claims set status='accepted' where id=$1",[claim]);
 assert.equal((await db.query("select count(*)::int n from public.email_outbox where kind='receipt'")).rows[0].n,0);
 await db.query("update public.claims set status='picked_up' where id=$1",[claim]);
 await db.query("update public.claims set status='picked_up' where id=$1",[claim]);
 rows=(await db.query("select * from public.email_outbox where kind='receipt'")).rows;assert.equal(rows.length,2);
 assert.ok(rows.every(r=>r.payload.claimReference===claim));
});
test('nearby alerts require opt-in and radius; the donor is excluded',async()=>{
 await reset();await db.query('insert into public.email_preferences(user_id,nearby_enabled,alert_lat,alert_lng,radius_m) values($1,true,14.6,121,500),($2,true,14.6,121,500),($3,true,15.6,122,500)',[member,donor,outsider]);await createPost();
 const rows=(await db.query("select * from public.email_outbox where kind='nearby'")).rows;assert.equal(rows.length,1);assert.equal(rows[0].user_id,member);
 assert.equal('alert_lat' in rows[0].payload,false);
 await actor(member,()=>db.query('update public.email_preferences set nearby_enabled=false,alert_lat=null,alert_lng=null where user_id=$1',[member]));
 const jobs=(await db.query('select * from public.claim_email_jobs()')).rows;assert.equal(jobs.length,0);
});
test('email settings and outbox are isolated from other members',async()=>{
 await reset();await actor(member,()=>db.query('insert into public.email_preferences(user_id) values($1)',[member]));
 assert.equal((await actor(outsider,()=>db.query('select * from public.email_preferences'))).rows.length,0);
 await assert.rejects(actor(outsider,()=>db.query('insert into public.email_preferences(user_id) values($1)',[donor])),/row-level security/i);
 await assert.rejects(actor(member,()=>db.query('select * from public.email_outbox')),/permission denied/i);
 await assert.rejects(actor(member,()=>db.query('select * from public.claim_email_jobs()')),/permission denied/i);
 await assert.rejects(actor(member,()=>db.query('update public.email_preferences set nearby_enabled=true where user_id=$1',[member])),/check constraint/i);
});
test('dispatch resolves verified auth email, leases jobs once, and rejects stale acknowledgements',async()=>{
 await reset();await createPost();await createClaim();
 const jobs=(await db.query('select * from public.claim_email_jobs(1)')).rows;assert.equal(jobs.length,1);const job=jobs[0];
 assert.ok(['member@example.test','donor@example.test'].includes(job.recipient_email));
 await db.query("select public.finish_email_job($1,$2,'sent','fake-provider')",[job.id,'99999999-9999-4999-8999-999999999999']);
 assert.equal((await db.query('select state from public.email_outbox where id=$1',[job.id])).rows[0].state,'processing');
 const second=(await db.query('select * from public.claim_email_jobs(10)')).rows;assert.equal(second.length,1);assert.notEqual(second[0].id,job.id);
 await db.query("select public.finish_email_job($1,$2,'sent','fake-provider')",[job.id,job.lease_id]);
 assert.equal((await db.query('select state from public.email_outbox where id=$1',[job.id])).rows[0].state,'sent');
});
test('unverified email and opted-out recipients never receive leased jobs',async()=>{
 await reset();await db.query("insert into public.email_preferences(user_id,claims_enabled) values($1,false)",[donor]);await createPost();await createClaim();
 await db.query('update auth.users set email_confirmed_at=null where id=$1',[member]);
 assert.equal((await db.query('select * from public.claim_email_jobs()')).rows.length,0);
 await db.query('update auth.users set email_confirmed_at=now() where id=$1',[member]);
});
test('nearby pending jobs recheck location, availability and subscription before sending',async()=>{
 await reset();await db.query('insert into public.email_preferences(user_id,nearby_enabled,alert_lat,alert_lng,radius_m) values($1,true,14.6,121,500)',[member]);await createPost();
 await db.query('update public.email_preferences set alert_lat=15.6 where user_id=$1',[member]);
 assert.equal((await db.query('select * from public.claim_email_jobs()')).rows.length,0);
});
test('retry limit and retention prevent unbounded retries and purge old delivery data',async()=>{
 await reset();await createPost();await createClaim();await db.exec("update public.email_outbox set attempts=5");
 assert.equal((await db.query('select * from public.claim_email_jobs()')).rows.length,0);
 await db.exec("update public.email_outbox set finished_at=now()-interval '31 days'");await db.query('select public.purge_email_history()');assert.equal((await db.query('select * from public.email_outbox')).rows.length,0);
});

const bundle=await build({entryPoints:['apps/backend/src/email/worker.ts'],bundle:true,platform:'node',format:'esm',packages:'external',write:false,logLevel:'silent'});
// Bundle to a workspace file so external imports resolve normally.
import {mkdir,mkdtemp,writeFile,rm} from 'node:fs/promises';import path from 'node:path';import {pathToFileURL} from 'node:url';
await mkdir('output',{recursive:true});const dir=await mkdtemp(path.resolve('output/email-test-'));const file=path.join(dir,'worker.mjs');await writeFile(file,bundle.outputFiles[0].text);const {renderEmail,sendEmail,EmailSendError,publicAppUrl,sendSmtpEmail}=await import(pathToFileURL(file));
after(async()=>{if(path.dirname(dir)!==path.resolve('output'))throw new Error('Unsafe cleanup');await rm(dir,{recursive:true,force:true});});
test('receipt email contains only handover details, never QR credentials or a payment claim',()=>{
 const output=renderEmail({id:claim,kind:'receipt',payload:{foodName:'Rice\r\nBcc: outsider',quantity:2,claimantName:'Recipient',donorName:'Donor',claimReference:claim,pickup_code:'secret-pass'}},'http://127.0.0.1:5175');
 assert.match(output.text,/Recipient: Recipient/);assert.match(output.text,/not a payment or tax receipt/);assert.doesNotMatch(output.text,/secret-pass/);assert.doesNotMatch(output.subject,/[\r\n]/);
 assert.throws(()=>publicAppUrl('https://user:secret@example.com'));assert.throws(()=>publicAppUrl('http://example.com'));
});
test('Resend sends to the verified recipient only, with stable idempotency and no CC',async()=>{
 let captured;const fetcher=async(url,options)=>{captured={url,options};return new Response(JSON.stringify({id:'provider-message'}),{status:200});};
 const job={id:claim,lease_id:claim,kind:'receipt',recipient_email:'member@example.test',payload:{}};
 assert.equal(await sendEmail(job,{key:'test-placeholder',from:'FoodRescue <notifications@example.test>',appUrl:'https://example.test'},fetcher),'provider-message');
 assert.equal(captured.options.headers['Idempotency-Key'],`foodrescue/${claim}`);const body=JSON.parse(captured.options.body);assert.deepEqual(body.to,['member@example.test']);assert.equal(body.cc,undefined);assert.equal(body.bcc,undefined);
 await assert.rejects(sendEmail(job,{key:'test',from:'sender@example.test',appUrl:'https://example.test'},async()=>new Response('',{status:429})),e=>e instanceof EmailSendError&&e.retryable);
 await assert.rejects(sendEmail(job,{key:'test',from:'sender@example.test',appUrl:'https://example.test'},async()=>new Response('',{status:401})),e=>e instanceof EmailSendError&&!e.retryable);
});


test('Gmail uses the authenticated real sender with FoodRescue display name',async()=>{
 let options;
 const transport={sendMail:async value=>{options=value;return {accepted:['member@example.test'],messageId:'smtp-id'};}};
 const job={id:claim,lease_id:claim,kind:'receipt',recipient_email:'member@example.test',payload:{}};
 assert.equal(await sendSmtpEmail(job,'owner@gmail.com','https://example.test',transport),'smtp-id');
 assert.deepEqual(options.from,{name:'FoodRescue',address:'owner@gmail.com'});
 assert.equal(options.to,'member@example.test');assert.equal(options.disableFileAccess,true);assert.equal(options.disableUrlAccess,true);
 assert.equal(options.messageId,`<foodrescue-${claim}@gmail.com>`);
 const uncertain={sendMail:async()=>{throw {code:'ETIMEDOUT',command:'DATA'};}};
 await assert.rejects(sendSmtpEmail(job,'owner@gmail.com','https://example.test',uncertain),e=>e.uncertain&&!e.retryable);
 const disconnected={sendMail:async()=>{throw {code:'ECONNECTION',command:'CONN'};}};
 await assert.rejects(sendSmtpEmail(job,'owner@gmail.com','https://example.test',disconnected),e=>!e.uncertain&&e.retryable);
});
test('an interrupted SMTP handover is marked uncertain instead of being sent twice',async()=>{
 await reset();await createPost();await createClaim();
 const job=(await db.query('select * from public.claim_email_jobs(1)')).rows[0];
 assert.equal((await db.query('select public.prepare_smtp_email_job($1,$2) ready',[job.id,job.lease_id])).rows[0].ready,true);
 assert.equal((await db.query('select public.prepare_smtp_email_job($1,$2) ready',[job.id,job.lease_id])).rows[0].ready,false);
 await db.query("update public.email_outbox set lease_until=now()-interval '1 minute' where id=$1",[job.id]);
 await db.query('select * from public.claim_email_jobs(10)');
 assert.equal((await db.query('select state from public.email_outbox where id=$1',[job.id])).rows[0].state,'uncertain');
});
test('an email address change prevents retrying delivery to the old mailbox',async()=>{
 await reset();await createPost();await createClaim();
 const jobs=(await db.query('select * from public.claim_email_jobs(10)')).rows;
 const job=jobs.find(item=>item.user_id===member);
 await db.query("select public.finish_email_job($1,$2,'retry',null)",[job.id,job.lease_id]);
 await db.query("update auth.users set email='changed@example.test' where id=$1",[member]);
 await db.query('update public.email_outbox set next_attempt_at=now() where id=$1',[job.id]);
 const retry=(await db.query('select * from public.claim_email_jobs(10)')).rows;assert.ok(!retry.some(item=>item.id===job.id));
 await db.query("update auth.users set email='member@example.test' where id=$1",[member]);
});
