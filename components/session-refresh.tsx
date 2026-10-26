'use client';
import {useEffect} from 'react';
import {useRouter} from 'next/navigation';

type SessionEvent='start'|'cancel'|'complete';
// Only a logout notification is shared between tabs, never session tokens.
export function notifyLogout(phase:SessionEvent){
 window.dispatchEvent(new CustomEvent('laporkuy:session',{detail:phase}));
 try{localStorage.setItem('laporkuy:session',JSON.stringify({phase,at:Date.now(),id:Math.random()}));}catch{}
}

export function SessionRefresh({enabled,signedIn}:{enabled:boolean;signedIn:boolean}){
 const router=useRouter();
 useEffect(()=>{
  if(!enabled)return;
  let disposed=false,stopped=false,pending=false,lastCheck=0;
  let timer:ReturnType<typeof setTimeout>;
  let controller:AbortController|undefined;
  const schedule=(delay=60000)=>{clearTimeout(timer);if(!disposed&&!stopped)timer=setTimeout(check,delay);};
  async function check(){
   if(disposed||stopped||pending||document.hidden)return;
   if(Date.now()-lastCheck<5000){schedule(5000);return;}
   pending=true;lastCheck=Date.now();controller=new AbortController();
   const signal=controller.signal;
   const timeout=setTimeout(()=>controller?.abort(),15000);
   let retry=60000;
   try{
    const refresh=()=>fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'refresh'}),signal});
    // Serialize rotating refresh cookies across tabs when Web Locks is available.
    const response=navigator.locks?await navigator.locks.request('laporkuy-session-refresh',{signal},refresh):await refresh();
    if(disposed||stopped)return;
    if(response.status===401){stopped=true;router.refresh();return;}
    if(!response.ok){retry=30000;return;}
    const data=await response.json();
    if(data.refreshed||!signedIn)router.refresh();
   }catch{retry=30000;}finally{
    clearTimeout(timeout);pending=false;controller=undefined;schedule(retry);
   }
  }
  const sessionEvent=(phase:SessionEvent)=>{
   if(phase==='start'||phase==='complete'){
    stopped=true;clearTimeout(timer);controller?.abort();
    if(phase==='complete')router.refresh();
   }else if(phase==='cancel'){stopped=false;schedule(1000);}
  };
  const local=(event:Event)=>sessionEvent((event as CustomEvent<SessionEvent>).detail);
  const storage=(event:StorageEvent)=>{
   if(event.key!=='laporkuy:session'||!event.newValue)return;
   try{const {phase}=JSON.parse(event.newValue);if(['start','cancel','complete'].includes(phase))sessionEvent(phase);}catch{}
  };
  const resume=()=>{if(!document.hidden)void check();};
  document.addEventListener('visibilitychange',resume);
  window.addEventListener('focus',resume);window.addEventListener('pageshow',resume);window.addEventListener('online',resume);
  window.addEventListener('laporkuy:session',local);window.addEventListener('storage',storage);
  void check();
  return()=>{
   disposed=true;clearTimeout(timer);controller?.abort();
   document.removeEventListener('visibilitychange',resume);
   window.removeEventListener('focus',resume);window.removeEventListener('pageshow',resume);window.removeEventListener('online',resume);
   window.removeEventListener('laporkuy:session',local);window.removeEventListener('storage',storage);
  };
 },[enabled,signedIn,router]);
 return null;
}
