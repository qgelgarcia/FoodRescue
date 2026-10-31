import { supabase, isSupabaseConfigured } from './supabase';

export async function getEmailPreferences() {
  if(!isSupabaseConfigured()) throw new Error('Connect your account service to manage email notifications.');
  const {data:auth,error:authError}=await supabase.auth.getUser();
  if(authError||!auth.user) throw new Error('Please sign in again to manage email notifications.');
  const {data,error}=await supabase.from('email_preferences').select('claims_enabled,receipts_enabled,nearby_enabled,alert_lat,alert_lng,radius_m').eq('user_id',auth.user.id).maybeSingle();
  if(error) throw new Error('Email settings could not be loaded. Please try again.');
  return {userId:auth.user.id,email:auth.user.email||'',preferences:data||{claims_enabled:true,receipts_enabled:true,nearby_enabled:false,alert_lat:null,alert_lng:null,radius_m:1000}};
}
export async function saveEmailPreferences(preferences) {
  const {data:auth,error:authError}=await supabase.auth.getUser();
  if(authError||!auth.user) throw new Error('Please sign in again to save email settings.');
  const {error}=await supabase.from('email_preferences').upsert({user_id:auth.user.id,
    claims_enabled:Boolean(preferences.claims_enabled),receipts_enabled:Boolean(preferences.receipts_enabled),nearby_enabled:Boolean(preferences.nearby_enabled),
    radius_m:Number(preferences.radius_m),alert_lat:preferences.nearby_enabled?preferences.alert_lat:null,alert_lng:preferences.nearby_enabled?preferences.alert_lng:null},{onConflict:'user_id'});
  if(error) throw new Error('Email settings could not be saved. Please try again.');
}
