import { supabase, isSupabaseConfigured } from './supabase';
export const TERMS_VERSION='2026-10-31.1';
async function verifyAccount(userId) {
 if(!isSupabaseConfigured())throw new Error('Account connection is required to review terms.');
 const {data,error}=await supabase.auth.getUser();
 if(error||data.user?.id!==userId)throw new Error('Your session changed. Please sign in again.');
}
export async function getTermsAcceptance(userId) {
 await verifyAccount(userId);
 const {data,error}=await supabase.from('terms_acceptances').select('terms_version,accepted_at').eq('user_id',userId).eq('terms_version',TERMS_VERSION).maybeSingle();
 if(error)throw new Error('We could not check your terms acceptance. Please try again.');
 return data;
}
export async function acceptTerms(userId,emailUpdates) {
 await verifyAccount(userId);
 const {data,error}=await supabase.rpc('accept_current_terms',{p_version:TERMS_VERSION,p_email_updates:Boolean(emailUpdates)});
 if(error||data?.terms_version!==TERMS_VERSION||data?.user_id!==userId)throw new Error('Your acceptance could not be saved. Please try again.');
 return data;
}
