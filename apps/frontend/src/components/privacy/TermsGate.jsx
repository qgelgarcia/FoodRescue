import React,{useEffect,useRef,useState} from 'react';
import {useHistory} from 'react-router-dom';
import {ShieldCheck,LogOut} from 'lucide-react';
import {acceptTerms,getTermsAcceptance,TERMS_VERSION} from '../../services/terms';
import {logout} from '../../services/auth';
import LoadingState from '../feedback/LoadingState';
import './TermsGate.css';

export default function TermsGate({userId,children}) {
 const [status,setStatus]=useState('loading');
 const [agreed,setAgreed]=useState(false);
 const [emailUpdates,setEmailUpdates]=useState(false);
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const [revision,setRevision]=useState(0);
 const owner=useRef(userId);const generation=useRef(0);const heading=useRef(null);const history=useHistory();
 useEffect(()=>{owner.current=userId;const current=++generation.current;setStatus('loading');setAgreed(false);setEmailUpdates(false);setError('');setBusy(false);
 getTermsAcceptance(userId).then(record=>{if(current===generation.current)setStatus(record?'accepted':'review');}).catch(cause=>{if(current===generation.current){setError(cause.message);setStatus('error');}});
 return()=>{generation.current++;};},[userId,revision]);
 useEffect(()=>{if(status==='review')heading.current?.focus();},[status]);
 async function continueToApp(event){event.preventDefault();if(!agreed||busy)return;const current=generation.current;setBusy(true);setError('');
 try{await acceptTerms(userId,emailUpdates);if(current===generation.current)setStatus('accepted');}
 catch(cause){if(current===generation.current)setError(cause.message);}
 finally{if(current===generation.current)setBusy(false);}
 }
 async function signOut(){if(busy)return;setBusy(true);try{await logout({localOnly:true});history.replace('/login');}finally{setBusy(false);}}
 if(status==='accepted'&&owner.current===userId)return children;
 if(status==='loading'||owner.current!==userId)return <LoadingState fullScreen label="Checking privacy preferences" onRetry={()=>setRevision(value=>value+1)}/>;
 return <div className="consent-page"><main className="consent-content">
   <ShieldCheck size={32} aria-hidden="true"/>
   <h1 ref={heading} tabIndex={-1}>Before you use FoodRescue</h1>
   <p className="consent-intro">Review how sharing, email, and your information work. Your acceptance is saved to your account for version {TERMS_VERSION}.</p>
   {status==='error'?<LoadingState error={error} onRetry={()=>setRevision(value=>value+1)}/>:<>
   <section><h2>Your email and pickup details</h2><p>We use your account email for sign-in, verification, password recovery, and any pickup emails you choose below. Claim updates and handover receipts go only to the donor and recipient involved. The donor can receive the recipient’s name and portion count. Pickup notification emails use the configured Gmail sender and Google’s mail service; Supabase Auth handles sign-in and recovery emails. Pickup QR codes and passwords are not included in notification emails.</p></section>
   <section><h2>Location is your choice</h2><p>Nearby-food emails require a separate opt-in, saved location, and radius in Profile. Turning them off and saving removes that alert location. Optional pickup journey sharing shows your latest location only to the relevant donor and ends when stopped or the pickup closes. Browsing the map does not automatically enable email alerts or background tracking.</p></section>
   <section><h2>What is stored and shared</h2><p>Supabase stores account and profile details, listings, claims, reports, photos, preferences, and saved chats. Vercel hosts the website and API. Listing details, pickup pins, and food-photo URLs are visible to people browsing listings, so keep private information out of them. Reports and moderation records are available to authorized reviewers. Pickup and report history can remain after resolution.</p></section>
   <section><h2>Using the AI assistant</h2><p>When you send a chat message, your question and recent conversation context are sent through OpenRouter to the selected model provider. The app requests zero-retention routing and may show unavailable when no compatible endpoint exists. Saved app conversations remain until you delete them. Never include passwords, pickup tokens, or private health information. Nutrition responses are estimates and general education, not medical treatment advice.</p></section>
   <section><h2>Safe and respectful sharing</h2><p>Give accurate food, ingredient, allergen, portion, and pickup information. Claim only what you intend to collect, wait for donor approval, and confirm handover only after pickup. A listing deadline does not guarantee food safety. Report misleading listings or unsafe conduct. Do not harass members, access other accounts, or share someone else’s pickup code.</p><p>Keep your sign-in details private, use a strong password, and sign out on shared devices. Internet services and email have risks; these rules do not promise absolute security. You can manage email and location choices in Profile and use Reports &amp; Support for concerns.</p></section>
   <form onSubmit={continueToApp} className="consent-actions">
    <label><input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)} disabled={busy} required/><span>I agree to the terms of use and acknowledge the privacy information above.</span></label>
    <label><input type="checkbox" checked={emailUpdates} onChange={e=>setEmailUpdates(e.target.checked)} disabled={busy}/><span>Email me claim updates and pickup receipts. This is optional and can be changed in Profile.</span></label>
    {error&&<p role="alert" className="consent-error">{error}</p>}
    <button type="submit" disabled={!agreed||busy}>{busy?'Saving acceptance…':'Agree and continue'}</button>
   </form></>}
   <button type="button" className="consent-signout" onClick={()=>void signOut()} disabled={busy}><LogOut size={16}/>Not now—sign out</button>
 </main></div>;
}
