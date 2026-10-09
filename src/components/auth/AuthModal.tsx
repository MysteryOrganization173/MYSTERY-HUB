import {BUSINESS_CONFIG} from '../../config/business';
import {SecurityDialog} from './SecurityDialog';
import {AuthFields} from './AuthFields';
import React,{useRef,useState} from 'react';
import {useApp} from '../../context/AppContext';
import {registerOnServer,loginOnServer} from '../../services/apiClient';

export const AuthModal:React.FC=()=>{
  const {isAuthModalOpen,closeAuth,authMode,switchAuthMode,loginUser,authContextMessage}=useApp();
  const [name,setName]=useState(''),[email,setEmail]=useState(''),[identifier,setIdentifier]=useState(''),[password,setPassword]=useState('');
  const [rememberMe,setRememberMe]=useState(false),[busy,setBusy]=useState(false),[recovery,setRecovery]=useState(false),[emailOpen,setEmailOpen]=useState(false),[existing,setExisting]=useState(false),[error,setError]=useState('');
  const submitting=useRef(false);
  if(!isAuthModalOpen)return null;
  const signup=authMode==='signup';
  const switchMode=(mode:'signup'|'login')=>{setError('');setExisting(false);setPassword('');setRecovery(false);switchAuthMode(mode);};
  const close=()=>{setRecovery(false);setPassword('');setError('');setExisting(false);closeAuth();};
  const submit=async(event:React.FormEvent)=>{
    event.preventDefault();if(submitting.current)return;setError('');setExisting(false);
    if(!identifier.trim()||!password||(signup&&!name.trim())){setError('Please complete all required fields.');return;}
    if(password.length<8){setError('Password must be at least 8 characters long.');return;}
    submitting.current=true;setBusy(true);
    try {
      const result=signup?await registerOnServer({name:name.trim(),identifier:identifier.trim(),phone:identifier.trim(),email:email.trim()||undefined,password,rememberMe}):await loginOnServer({identifier:identifier.trim(),password,rememberMe});
      setName('');setEmail('');setIdentifier('');setPassword('');setEmailOpen(false);loginUser(result.user,result.token,rememberMe);
    } catch(e){setExisting(signup&&(e as {status?:number}).status===409);setError(e instanceof Error?e.message:'Could not sign in. Please try again.');}
    finally{submitting.current=false;setBusy(false);}
  };
  return <SecurityDialog title={recovery?'Account recovery':signup?'Create your account':'Sign in'} onClose={close}>
    {recovery?<div className="space-y-4 text-sm"><p>We can help you restore access to your Mystery Hub account.</p><p className="text-slate-300">Contact support to confirm ownership. Never send your password.</p><a className="mh-button-secondary w-full" href={BUSINESS_CONFIG.getGeneralWhatsAppUrl('Hi Mystery Hub, I need help accessing my account.')} target="_blank" rel="noopener noreferrer">Contact support on WhatsApp</a><a className="block min-h-11 text-emerald-300 underline break-all" href={BUSINESS_CONFIG.contact.emailLink}>{BUSINESS_CONFIG.contact.supportEmail}</a><button className="mh-button-secondary w-full" onClick={()=>setRecovery(false)}>Back to sign in</button></div>:<>
      <p className="text-sm text-slate-300 mb-4">{signup?'Track your orders, use Wallet and create your business website.':'Your orders, Wallet and websites, all in one place.'}</p>
      {authContextMessage&&<p className="text-sm text-emerald-300 mb-4">{authContextMessage}</p>}
      <form onInvalid={()=>setError('Please check the highlighted fields.')} onSubmit={submit} className="space-y-3" aria-busy={busy}>
        <AuthFields signup={signup} busy={busy} error={error} emailOpen={emailOpen}
          values={{name,identifier,email,password,rememberMe}}
          changes={{name:setName,identifier:setIdentifier,email:setEmail,password:setPassword,rememberMe:setRememberMe}}
          revealEmail={()=>setEmailOpen(true)} recover={()=>{setPassword('');setRecovery(true);}} />
        {error&&<p id="auth-error" role="alert" className="text-sm text-rose-300 rounded-xl border border-rose-400/30 bg-rose-400/5 p-3">{error}</p>}
        {existing&&<div className="flex flex-wrap gap-2"><button type="button" className="mh-button-secondary" onClick={()=>switchMode('login')}>Sign in instead</button><button type="button" className="min-h-11 text-sm text-emerald-300" onClick={()=>{setPassword('');setRecovery(true);}}>Get account help</button></div>}
        <button type="submit" disabled={busy} className="mh-button w-full">{busy?'Please wait…':signup?'Create Account':'Sign In'}</button>
        {signup&&<details className="text-xs text-slate-400"><summary className="min-h-11 flex items-center cursor-pointer">About your account phone</summary><p className="pb-2">Use a phone number that is not on another account. Phone ownership is not verified by SMS.</p></details>}
      </form>
      <p className="mt-4 pt-3 border-t border-slate-800 text-sm text-slate-300">{signup?'Already have an account?':'New to Mystery Hub?'} <button type="button" disabled={busy} className="min-h-11 text-emerald-300 font-semibold" onClick={()=>switchMode(signup?'login':'signup')}>{signup?'Sign in':'Create an account'}</button></p>
    </>}
  </SecurityDialog>;
};
