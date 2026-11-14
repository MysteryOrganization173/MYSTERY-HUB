/** Real component; preview server supplies the actual API and synthetic stored records. */
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {AdminContactHub} from '../../../../src/components/admin/sections/AdminContactHub';
function Fixture(){
 const initial='browser-admin-'+new URLSearchParams(location.search).get('width'),[token,setToken]=useState(initial);
 Object.assign(window,{__contactFixture:{logout:()=>setToken('expired'),login:()=>setToken(initial),openOrder:'',openAccount:''}});
 return <main className="min-h-screen bg-slate-950 p-3 text-white sm:p-6"><p className="mb-3 text-xs text-slate-400">Synthetic acceptance environment · no real customers or sending</p><AdminContactHub key={token} token={token} onOpenAccount={id=>(window as any).__contactFixture.openAccount=id} onOpenOrder={ref=>(window as any).__contactFixture.openOrder=ref}/></main>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
