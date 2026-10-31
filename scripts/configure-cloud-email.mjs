import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const url=new URL(process.argv[2]||'');
if(url.protocol!=='https:'||!url.hostname.endsWith('.vercel.app')||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw new Error('Provide the HTTPS Vercel production origin.');
const env=dotenv.parse(await readFile(path.join(root,'apps/backend/.env')));
if(!env.EMAIL_DISPATCH_SECRET||env.EMAIL_DISPATCH_SECRET.length<32)throw new Error('Missing local email dispatch secret.');
const connection=new URL((await readFile(path.join(root,'supabase/.temp/pooler-url'),'utf8')).trim());connection.password=env.DB_PASSWORD||'';
const ca=await readFile(env.DB_SSL_CA||path.join(root,'supabase/.temp/prod-ca-2021.crt'),'utf8');
const client=new pg.Client({connectionString:connection.toString(),ssl:{rejectUnauthorized:true,ca},connectionTimeoutMillis:10000,query_timeout:20000});
let transaction=false;
try{
 await client.connect();
 const {rows}=await client.query("select has_table_privilege('authenticated','vault.decrypted_secrets','select') or has_table_privilege('anon','vault.decrypted_secrets','select') as vault_exposed, has_table_privilege('authenticated','net.http_request_queue','select') or has_table_privilege('anon','net.http_request_queue','select') as queue_exposed");
 if(rows[0].vault_exposed)throw new Error('Refusing to store the scheduler secret: Vault is accessible to client roles.');
 // Hosted pg_net tables may have platform-owned SQL grants. Browser roles cannot log in
 // to Postgres directly; require proof that net is absent from the exposed Data API.
 if(rows[0].queue_exposed){
  const roles=await client.query("select count(*)::integer count from pg_roles where rolname in ('anon','authenticated') and rolcanlogin");
  if(roles.rows[0].count!==0)throw new Error('Refusing scheduler setup: client roles can log in to Postgres.');
  const response=await fetch(`${env.SUPABASE_URL}/rest/v1/http_request_queue?select=id&limit=0`,{headers:{apikey:env.SUPABASE_ANON_KEY,Authorization:`Bearer ${env.SUPABASE_ANON_KEY}`,'Accept-Profile':'net'},signal:AbortSignal.timeout(10000)});
  const denied=await response.json().catch(()=>({}));
  if(response.status!==406||denied.code!=='PGRST106')throw new Error('Refusing scheduler setup: net schema is exposed through the Data API.');
 }
 await client.query('begin');transaction=true;
 for(const [name,value]of [['foodrescue_email_dispatch_url',`${url.origin}/api/internal/email-dispatch`],['foodrescue_email_dispatch_secret',env.EMAIL_DISPATCH_SECRET]]){
  const existing=await client.query('select id from vault.secrets where name=$1',[name]);
  if(existing.rows.length)await client.query('select vault.update_secret($1,$2)',[existing.rows[0].id,value]);
  else await client.query('select vault.create_secret($1,$2,$3)',[value,name,'FoodRescue protected Vercel email scheduler']);
 }
 await client.query('commit');transaction=false;
 console.log('Cloud email scheduler configured in Vault. Client access checks passed. Secret values were not displayed.');
}catch(error){if(transaction)await client.query('rollback').catch(()=>{});console.error('Scheduler setup failed:',error.code||error.message);process.exitCode=1;}finally{await client.end();}
