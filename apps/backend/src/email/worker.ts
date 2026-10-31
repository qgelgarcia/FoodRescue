import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

type EmailJob = { id: string; lease_id: string; kind: 'claim'|'receipt'|'nearby'; recipient_email: string; payload: Record<string, unknown> };
const statusNames: Record<string,string> = { pending:'requested', accepted:'accepted', rejected:'declined', cancelled:'cancelled', expired:'expired', picked_up:'picked up' };
function line(value: unknown, max=400): string { return String(value ?? '').replace(/[\r\n\u0000-\u001f]+/g,' ').slice(0,max); }
export function publicAppUrl(raw: string): string {
  const url = new URL(raw);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname))) || url.username || url.password || url.search || url.hash) throw new Error('Invalid APP_PUBLIC_URL');
  return url.origin;
}
export function renderEmail(job: Pick<EmailJob,'id'|'kind'|'payload'>, appUrl: string) {
  const p=job.payload;
  const food=line(p.foodName,120);
  const lines: string[]=[];
  let subject: string;
  if(job.kind==='receipt') {
    subject='FoodRescue pickup confirmation receipt';
    lines.push('Your pickup has been confirmed by the donor.',`Receipt reference: ${line(p.claimReference)}`,`Confirmed: ${line(p.eventAt)}`);
  } else if(job.kind==='nearby') {
    subject='New food available near your saved alert location';
    lines.push('A new food listing was posted within your saved email-alert radius. Availability may change before you open the app.');
  } else {
    subject=`FoodRescue pickup ${statusNames[String(p.status)] || 'update'}`;
    lines.push(`Pickup status: ${statusNames[String(p.status)] || 'updated'}`,`Updated: ${line(p.eventAt)}`);
  }
  lines.push('',`Food: ${food}`,`${job.kind==='nearby'?'Portions at posting':'Portions'}: ${line(p.quantity,10)}`);
  if(job.kind!=='nearby') lines.push(`Donor: ${line(p.donorName,100)}`,`Recipient: ${line(p.claimantName,100)}`);
  lines.push(`Pickup location: ${line(p.pickupAddress)}`);
  if(job.kind!=='receipt') lines.push(`Pickup deadline: ${line(p.pickupDeadline)}`);
  if(job.kind==='receipt') lines.push('This confirms a food handover. It is not a payment or tax receipt.');
  lines.push('',`Open FoodRescue: ${publicAppUrl(appUrl)}${job.kind==='nearby'?'/app/map':'/app/history'}`,
    'Pickup passes and QR codes are available only inside the app.','',`Email settings: ${publicAppUrl(appUrl)}/app/profile`);
  return {subject,text:lines.join('\n')};
}
export class EmailSendError extends Error {
  constructor(readonly retryable: boolean, readonly uncertain = false) { super('Email delivery failed'); }
}
export async function sendEmail(job: EmailJob, config: {key:string;from:string;appUrl:string}, fetcher: typeof fetch=fetch): Promise<string> {
  if(!job.recipient_email || /[\r\n]/.test(job.recipient_email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(job.recipient_email)) throw new EmailSendError(false);
  const content=renderEmail(job,config.appUrl);
  let response: Response;
  try {
    response=await fetcher('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(20000),
      headers:{Authorization:`Bearer ${config.key}`,'Content-Type':'application/json','Idempotency-Key':`foodrescue/${job.id}`},
      body:JSON.stringify({from:config.from,to:[job.recipient_email],...content})});
  } catch { throw new EmailSendError(true); }
  if(!response.ok) { await response.body?.cancel(); throw new EmailSendError(response.status===429 || response.status>=500); }
  const body=await response.json().catch(()=>null) as {id?:string}|null;
  if(!body?.id) throw new EmailSendError(true);
  return body.id;
}
export function gmailTransport(user: string, password: string) {
  return nodemailer.createTransport({host:'smtp.gmail.com',port:465,secure:true,
    auth:{user,pass:password},tls:{rejectUnauthorized:true,minVersion:'TLSv1.2'},
    connectionTimeout:15000,greetingTimeout:10000,socketTimeout:20000,
    disableFileAccess:true,disableUrlAccess:true});
}
export async function sendSmtpEmail(job: EmailJob, user: string, appUrl: string,
  transport: {sendMail: (options: Record<string, unknown>) => Promise<{messageId?:string;accepted?:unknown[]}>}): Promise<string> {
  if(!/^[^\s@]+@gmail\.com$/i.test(user)||!job.recipient_email||/[\r\n]/.test(job.recipient_email)) throw new EmailSendError(false);
  const content=renderEmail(job,appUrl);
  try {
    const result=await transport.sendMail({from:{name:'FoodRescue',address:user},to:job.recipient_email,
      subject:content.subject,text:content.text,messageId:`<foodrescue-${job.id}@gmail.com>`,
      disableFileAccess:true,disableUrlAccess:true});
    if(!result.accepted?.some(address=>String(address).toLowerCase()===job.recipient_email.toLowerCase())) throw new EmailSendError(false);
    return result.messageId||`foodrescue-${job.id}`;
  } catch(cause) {
    if(cause instanceof EmailSendError)throw cause;
    const error=cause as {code?:string;command?:string};
    // Only connection failures before SMTP delivery are safe to retry automatically.
    const beforeDelivery=error.command==='CONN';
    const permanent=['EAUTH','EENVELOPE','EMESSAGE'].includes(error.code||'');
    throw new EmailSendError(beforeDelivery&&!permanent,!beforeDelivery&&!permanent);
  }
}
export function createEmailProcessor() {
  if(process.env.EMAIL_NOTIFICATIONS_ENABLED!=='true') return null;
  const {RESEND_API_KEY:key,EMAIL_FROM:from,APP_PUBLIC_URL:appUrl,SUPABASE_URL:url,SUPABASE_SERVICE_ROLE_KEY:serviceKey,SMTP_USER:smtpUser,SMTP_PASS:smtpPass}=process.env;
  const provider=process.env.EMAIL_PROVIDER||'smtp';
  const smtp=provider==='smtp';
  if(!appUrl||!url||!serviceKey||(!smtp&&provider!=='resend')||(smtp?(!smtpUser||!smtpPass||!/^([^\s@]+)@gmail\.com$/i.test(smtpUser)):(!key||!from||/[\r\n]/.test(from)))) {
    console.error('[Email] Delivery disabled: sender configuration is incomplete.');return null;
  }
  try{publicAppUrl(appUrl);}catch{console.error('[Email] Delivery disabled: invalid app URL.');return null;}
  const transport=smtp?gmailTransport(smtpUser!,smtpPass!):null;
  const client=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init={})=>fetch(input,{...init,signal:AbortSignal.timeout(10000)})}});
  let busy=false;let stopped=false;let lastCleanup=0;
  async function tick() {
    if(busy||stopped)return;busy=true;
    try{
      if(Date.now()-lastCleanup>86400000){const {error}=await client.rpc('purge_email_history');if(!error)lastCleanup=Date.now();}
      const {data,error}=await client.rpc('claim_email_jobs',{p_limit:2});
      if(error){console.error('[Email] Queue unavailable.');return;}
      for(const job of (data||[]) as EmailJob[]){
        if(stopped)break;
        let result='sent';let providerId:string|null=null;
        try{
          if(smtp){
            const prepared=await client.rpc('prepare_smtp_email_job',{p_id:job.id,p_lease:job.lease_id});
            if(prepared.error||prepared.data!==true) {result='retry';}
            else providerId=await sendSmtpEmail(job,smtpUser!,appUrl!,transport!);
          }else providerId=await sendEmail(job,{key:key!,from:from!,appUrl:appUrl!});
        }catch(cause){result=cause instanceof EmailSendError?(cause.uncertain?'uncertain':cause.retryable?'retry':'failed'):'failed';}
        const {error:finishError}=await client.rpc('finish_email_job',{p_id:job.id,p_lease:job.lease_id,p_result:result,p_provider_id:providerId});
        if(finishError)console.error('[Email] Delivery acknowledgement unavailable; queue recovery will reconcile it.');
      }
    }catch{console.error('[Email] Worker temporarily unavailable.');}finally{busy=false;}
  }
  return { run: tick, close: ()=>{stopped=true;transport?.close();} };
}

export function startEmailWorker(): () => void {
  const processor=createEmailProcessor();
  if(!processor)return ()=>{};
  const timer=setInterval(()=>void processor.run(),15000);timer.unref();void processor.run();
  return ()=>{clearInterval(timer);processor.close();};
}
