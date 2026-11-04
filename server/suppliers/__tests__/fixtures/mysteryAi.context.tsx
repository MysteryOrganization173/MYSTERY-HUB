/** Local browser harness only. Not imported by application builds. */
import React,{createContext,useContext,useState} from 'react';
const Context=createContext<any>(null);
export const useApp=()=>useContext(Context);
export function MockProvider({children}:{children:React.ReactNode}){
 const [open,setOpen]=useState(true),[page,setPage]=useState('home');
 const fixture=(window as any).__aiFixture;
 fixture.open=()=>setOpen(true);fixture.setPage=setPage;
 return <Context.Provider value={{activePage:page,user:null,setActivePage:(p:string)=>{fixture.navigation.push({page:p});setPage(p);},openDataPage:(mode:string)=>{fixture.navigation.push({page:'data',mode});setPage('data');},editorAiContext:new URLSearchParams(location.search).has('editor')?{experienceMode:'website_editor',templateId:'tmpl-boutique',activeEditorSection:'contact',siteStatus:'draft',previewDevice:'mobile',hasUnsavedChanges:true}:null,
 activeEditorSite:null,isMysteryAiOpen:open,openMysteryAi:()=>setOpen(true),closeMysteryAi:()=>setOpen(false),waitlistInfo:null}}>{children}</Context.Provider>;
}
