import React, { useEffect, useRef, useState } from 'react';
import { SafeImage } from '../SafeImage';
import { listWebsiteAssets, requestWebsiteUpload, uploadWebsiteImage, finalizeWebsiteUpload, deleteWebsiteAsset } from '../../../services/apiClient';
import { WEBSITE_IMAGE_MIMES, WEBSITE_MEDIA_DEFAULTS, type WebsiteAsset } from '../../../config/websiteMedia';

export function WebsiteImageField({label,value,onChange,siteId,token}: {label:string;value:string;onChange:(url:string)=>void;siteId:string;token:string}) {
  const [open,setOpen]=useState(false);
  return <div className="space-y-2 min-w-0">
    <span className="block text-xs font-semibold text-slate-300">{label}</span>
    {value&&<SafeImage src={value} alt={`${label} current image`} className="w-24 h-24 object-cover rounded-lg border border-slate-700"/>}
    <div className="flex flex-wrap gap-2"><button type="button" onClick={()=>setOpen(true)} className="min-h-11 px-3 py-2 rounded-xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs">{value?'Replace image':'Upload Image / Media Library'}</button>{value && <button type="button" onClick={()=>onChange('')} className="min-h-11 px-3 text-xs text-slate-400">Remove / Reset</button>}</div>
    <details className="text-xs text-slate-400"><summary className="cursor-pointer">Advanced: image URL</summary><input aria-label={`${label} URL`} type="url" maxLength={500} value={value} onChange={e=>onChange(e.target.value)} className="w-full mt-2 p-2 rounded-lg bg-slate-900 border border-slate-700 text-white" placeholder="https://..." /></details>
    {open && <WebsiteImageLibrary siteId={siteId} token={token} onClose={()=>setOpen(false)} onChoose={url=>{onChange(url);setOpen(false);}} />}
  </div>;
}
export function WebsiteImageLibrary({siteId,token,onClose,onChoose}:{siteId:string;token:string;onClose:()=>void;onChoose:(url:string)=>void}) {
  const dialog=useRef<HTMLDialogElement>(null),controller=useRef<AbortController | null>(null),alive=useRef(true);
  const [assets,setAssets]=useState<WebsiteAsset[]>([]),[configured,setConfigured]=useState(false),[limits,setLimits]=useState<{maxAssets:number;maxBytes:number}>({maxAssets:WEBSITE_MEDIA_DEFAULTS.maxAssets,maxBytes:WEBSITE_MEDIA_DEFAULTS.maxBytes});
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[progress,setProgress]=useState(0),[error,setError]=useState(''),[pending,setPending]=useState<string | null>(null);
  const refresh=async()=>{const data=await listWebsiteAssets(token,siteId);if(alive.current){setAssets(data.assets);setConfigured(data.configured);setLimits(data.limits);}};
  useEffect(()=>{
    alive.current=true;dialog.current?.showModal();
    void refresh().catch(e=>{if(alive.current)setError(e.message);}).finally(()=>{if(alive.current)setLoading(false);});
    return ()=>{alive.current=false;controller.current?.abort();};
  },[siteId,token]);
  const close=()=>{controller.current?.abort();onClose();};
  const finalize=async(assetId:string)=>{
    const data=await finalizeWebsiteUpload(token,siteId,assetId,controller.current?.signal);
    if(alive.current){setPending(null);await refresh();onChoose(data.asset.secure_url!);}
  };
  const upload=async(file:File)=>{
    if(!WEBSITE_IMAGE_MIMES.includes(file.type as any)){setError('Choose a JPEG, PNG or WebP image.');return;}
    if(file.size>limits.maxBytes){setError(`Choose an image smaller than ${Math.round(limits.maxBytes/1024/1024)} MB.`);return;}
    setBusy(true);setProgress(0);setError('');setPending(null);controller.current=new AbortController();
    try {
      const {intent}=await requestWebsiteUpload(token,siteId,file);
      await uploadWebsiteImage(intent,file,p=>{if(alive.current)setProgress(p);},controller.current.signal);
      if(alive.current)setPending(intent.assetId);
      await finalize(intent.assetId);
    }catch(e:any){if(alive.current)setError(e.message || 'Could not upload this image.');}
    finally{if(alive.current)setBusy(false);}
  };
  return <dialog ref={dialog} aria-labelledby="website-image-library-title" onCancel={event=>{event.preventDefault();close();}} className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-2xl max-h-[85dvh] overflow-auto rounded-2xl bg-[#0b131a] text-white border border-slate-700 p-5 backdrop:bg-black/70">
    <div className="flex justify-between gap-3 items-center"><h2 id="website-image-library-title" className="font-bold">Website Image Library</h2><button type="button" onClick={close} aria-label="Close image library" className="px-3 py-2 rounded-lg bg-slate-800">Close</button></div>
    <p className="text-xs text-slate-400 my-3">{assets.length} ready images · up to {limits.maxAssets} images · {Math.round(limits.maxBytes/1024/1024)} MB each. Images are publicly visible when used on your site.</p>
    {loading ? <p>Loading images…</p> : <>
      {!configured && <p className="text-amber-300 text-sm mb-3">Image uploads are temporarily unavailable. Existing images still work.</p>}
      <label className={`inline-block px-4 py-2 rounded-xl bg-emerald-500 text-black font-semibold text-sm ${busy || !configured ? 'opacity-50' : 'cursor-pointer'}`}>Upload Image<input aria-label="Upload website image" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || !configured} className="sr-only" onChange={e=>{const file=e.target.files?.[0];if(file)void upload(file);e.target.value='';}} /></label>
      {busy && <div className="my-3 text-sm" role="status"><progress max={100} value={progress} className="w-full" />{progress<100 ? `Uploading ${progress}%` : 'Verifying image…'}</div>}
      {error && <p role="alert" className="text-rose-300 text-sm my-3">{error}</p>}
      {pending && !busy && <button type="button" className="text-emerald-300 underline text-sm my-3" onClick={async()=>{setBusy(true);setError('');controller.current=new AbortController();try{await finalize(pending);}catch(e:any){setError(e.message);}finally{if(alive.current)setBusy(false);}}}>Retry image verification</button>}
      {!assets.length && <p className="text-slate-400 text-sm my-6">No uploaded images yet. Upload one to use it across this website.</p>}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">{assets.map(asset=><article key={asset.id} className="border border-slate-800 rounded-xl p-2 min-w-0"><button type="button" disabled={busy} onClick={()=>onChoose(asset.secure_url!)} className="w-full text-left" aria-label={`Choose ${asset.original_filename}`}><SafeImage src={asset.delivery_url || asset.secure_url!} alt={asset.original_filename} className="w-full aspect-square rounded-lg" /><span className="block truncate text-xs mt-2">{asset.original_filename}</span></button><button type="button" disabled={busy} className="text-xs text-rose-300 mt-2" onClick={async()=>{if(!window.confirm('Delete this unused image from your library?'))return;setBusy(true);setError('');try{const result=await deleteWebsiteAsset(token,siteId,asset.id);await refresh();if(result.cleanupPending)setError('Image removed from library; provider cleanup is pending.');}catch(e:any){setError(e.message);}finally{if(alive.current)setBusy(false);}}}>Delete unused image</button></article>)}</div>
    </>}
  </dialog>;
}
