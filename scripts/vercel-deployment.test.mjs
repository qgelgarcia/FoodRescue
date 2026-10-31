import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile,mkdir,mkdtemp,writeFile,rm } from 'node:fs/promises';
import path from 'node:path';import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';import {PGlite} from '@electric-sql/pglite';

test('cloud email scheduler is service-only, inactive without Vault setup, and restricted to its deployment path',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema vault;create schema net;
 create table vault.decrypted_secrets(name text,decrypted_secret text);
 create function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer) returns bigint language sql as $$ select 7::bigint $$;`);
 let sql=await readFile('supabase/migrations/20261031020000_vercel_email_scheduler.sql','utf8');
 sql=sql.replace(/^create extension.*;$/gm,'').replace(/^select cron.schedule.*;$/gm,'');
 await db.exec(sql);
 assert.equal((await db.query('select public.dispatch_email_queue() result')).rows[0].result,null);
 await db.exec('set role authenticated');await assert.rejects(db.query('select public.dispatch_email_queue()'),/permission denied/i);await db.exec('reset role');
 await db.query('insert into vault.decrypted_secrets values($1,$2),($3,$4)',['foodrescue_email_dispatch_url','https://foodrescue-three.vercel.app/api/internal/email-dispatch','foodrescue_email_dispatch_secret','fixture-only-secret']);
 assert.equal((await db.query('select public.dispatch_email_queue() result')).rows[0].result,7);
 await db.query("update vault.decrypted_secrets set decrypted_secret='https://attacker.example/api/internal/email-dispatch' where name='foodrescue_email_dispatch_url'");
 await assert.rejects(db.query('select public.dispatch_email_queue()'),/Invalid email dispatch destination/);
 }finally{await db.close();}
});

test('Vercel API handler serves health, requires scheduler authentication, and does not start a background listener',async()=>{
 const root=path.resolve('output');await mkdir(root,{recursive:true});const dir=await mkdtemp(path.join(root,'vercel-test-'));
 let server;const previous={NODE_ENV:process.env.NODE_ENV,VERCEL:process.env.VERCEL,EMAIL_DISPATCH_SECRET:process.env.EMAIL_DISPATCH_SECRET,EMAIL_NOTIFICATIONS_ENABLED:process.env.EMAIL_NOTIFICATIONS_ENABLED};
 process.env.NODE_ENV='test';process.env.VERCEL='1';process.env.EMAIL_DISPATCH_SECRET='fixture-scheduler-secret';process.env.EMAIL_NOTIFICATIONS_ENABLED='false';
 try{
 const file=path.join(dir,'api.mjs');await build({entryPoints:['api/index.ts'],outfile:file,bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'silent'});
 const {default:app}=await import(pathToFileURL(file));
 server=await new Promise(resolve=>{const running=app.listen(0,'127.0.0.1',()=>resolve(running));});
 const base=`http://127.0.0.1:${server.address().port}`;
 assert.equal((await fetch(`${base}/api/health`)).status,200);
 assert.equal((await fetch(`${base}/api/internal/email-dispatch`,{method:'POST'})).status,401);
 assert.equal((await fetch(`${base}/api/internal/email-dispatch`,{method:'POST',headers:{Authorization:'Bearer wrong-secret'}})).status,401);
 assert.equal((await fetch(`${base}/api/internal/email-dispatch`,{method:'POST',headers:{Authorization:'Bearer fixture-scheduler-secret'}})).status,503);
 assert.equal((await fetch(`${base}/api/chat/conversations`)).status,401);
 }finally{
 if(server)await new Promise(resolve=>server.close(resolve));for(const [key,value]of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
 if(path.dirname(dir)!==root)throw new Error('Unexpected cleanup path');await rm(dir,{recursive:true,force:true});
 }
});
