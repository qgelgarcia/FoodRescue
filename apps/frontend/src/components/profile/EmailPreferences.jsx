import React, { useEffect, useRef, useState } from 'react';
import { Mail, MapPin } from 'lucide-react';
import { getEmailPreferences, saveEmailPreferences } from '../../services/email-preferences';
import './EmailPreferences.css';

export default function EmailPreferences({ userId }) {
  const [settings,setSettings]=useState(null);
  const [email,setEmail]=useState('');
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const [locating,setLocating]=useState(false);
  const generation=useRef(0);
  async function load(expected=generation.current) {
    setError('');
    try { const data=await getEmailPreferences(); if(generation.current!==expected||data.userId!==userId)return;setSettings(data.preferences);setEmail(data.email); }
    catch(cause) {if(generation.current===expected)setError(cause.message);}
  }
  useEffect(()=>{const current=++generation.current;setSettings(null);setEmail('');setMessage('');setLocating(false);setBusy(false);void load(current);return()=>{generation.current++;};},[userId]);
  function change(key,value) {setSettings(current=>({...current,[key]:value}));setMessage('');}
  function locate() {
    if(!navigator.geolocation){setError('Location is unavailable in this browser.');return;}
    const current=generation.current;setLocating(true);setError('');
    navigator.geolocation.getCurrentPosition(position=>{
      if(current!==generation.current)return;
      setSettings(value=>({...value,alert_lat:position.coords.latitude,alert_lng:position.coords.longitude}));setLocating(false);setMessage('Alert location selected. Save settings to use it for nearby-food emails.');
    },()=>{if(current!==generation.current)return;setLocating(false);setError('Location could not be read. Allow location access and try again.');},{timeout:15000,maximumAge:60000});
  }
  async function save(event) {
    event.preventDefault();if(busy||!settings)return;
    if(settings.nearby_enabled&&(settings.alert_lat===null||settings.alert_lng===null)){setError('Choose an alert location before enabling nearby-food emails.');return;}
    const current=generation.current;setBusy(true);setError('');setMessage('');
    try{await saveEmailPreferences(settings);if(current===generation.current){if(!settings.nearby_enabled)setSettings(value=>({...value,alert_lat:null,alert_lng:null}));setMessage('Email preferences saved.');}}
    catch(cause){if(current===generation.current)setError(cause.message);}
    finally{if(current===generation.current)setBusy(false);}
  }
  return <section className="email-settings" aria-labelledby="email-settings-heading">
    <header><h2 id="email-settings-heading"><Mail size={19}/> Email notifications</h2><p>{email?`Sent to your account email: ${email}`:'Manage emails sent to your verified account address.'}</p></header>
    {error&&<p className="email-settings-error" role="alert">{error} {!settings&&<button type="button" onClick={()=>void load()}>Try again</button>}</p>}
    {!settings&&!error?<p role="status">Loading email settings…</p>:settings&&<form onSubmit={save}>
      <label className="email-settings-option"><input type="checkbox" checked={settings.claims_enabled} disabled={busy} onChange={e=>change('claims_enabled',e.target.checked)}/><span><strong>Claims and pickup updates</strong><small>Requests, decisions, cancellations, and recipient name and portion details for the donor.</small></span></label>
      <label className="email-settings-option"><input type="checkbox" checked={settings.receipts_enabled} disabled={busy} onChange={e=>change('receipts_enabled',e.target.checked)}/><span><strong>Pickup receipts</strong><small>A confirmation for both parties after a donor verifies the handover.</small></span></label>
      <label className="email-settings-option"><input type="checkbox" checked={settings.nearby_enabled} disabled={busy} onChange={e=>change('nearby_enabled',e.target.checked)}/><span><strong>Food near my alert location</strong><small>New listings within your saved radius. This stores one alert location, without background tracking.</small></span></label>
      {settings.nearby_enabled&&<div className="email-settings-location">
        <label htmlFor="email-alert-radius">Alert radius<select id="email-alert-radius" disabled={busy} value={settings.radius_m} onChange={e=>change('radius_m',Number(e.target.value))}>{[[500,'500 m'],[1000,'1 km'],[3000,'3 km'],[5000,'5 km']].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <button type="button" onClick={locate} disabled={locating||busy}><MapPin size={16}/>{locating?'Finding location…':settings.alert_lat!==null?'Replace alert location':'Use current location for alerts'}</button>
        {settings.alert_lat!==null&&<span>Alert location selected</span>}
      </div>}
      <div className="email-settings-actions"><button type="submit" disabled={busy||locating}>{busy?'Saving…':'Save email settings'}</button><small>Turn nearby alerts off and save to remove your saved alert location.</small></div>
    </form>}
    {message&&<p role="status">{message}</p>}
  </section>;
}
