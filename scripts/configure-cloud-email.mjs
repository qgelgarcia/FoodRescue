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
 if(rows[0].vault_exposed||rows[0].queue_exposed)throw new Error('Refusing to store the scheduler secret: client access is broader than expected.');
 await client.query('begin');transaction=true;
 for(const [name,value]of [['foodrescue_email_dispatch_url',`${url.origin}/api/internal/email-dispatch`],['foodrescue_email_dispatch_secret',env.EMAIL_DISPATCH_SECRET]]){
  const existing=await client.query('select id from vault.secrets where name=$1',[name]);
  if(existing.rows.length)await client.query('select vault.update_secret($1,$2)',[existing.rows[0].id,value]);
  else await client.query('select vault.create_secret($1,$2,$3)',[value,name,'FoodRescue protected Vercel email scheduler']);
 }
 await client.query('commit');transaction=false;
 console.log('Cloud email scheduler configured in Vault. Client access checks passed. Secret values were not displayed.');
}catch(error){if(transaction)await client.query('rollback').catch(()=>{});console.error('Scheduler setup failed:',error.code||error.message);process.exitCode=1;}finally{await client.end();}
