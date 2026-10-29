import React,{useEffect,useState} from 'react';
import './member-home.css';
import {InstallAppPromo} from '../pwa/InstallAppPromo';
import {useApp} from '../../context/AppContext';
import {getAccountOrdersOnServer,getMyWebsitesOnServer} from '../../services/apiClient';
import type {AuthenticatedCustomerOrderDetails} from '../../../server/types/orders';
import {HomeWalletSummary} from './HomeWalletSummary';
import {MemberHomeView,type MemberWebsiteSummary} from './MemberHomeView';
import {memberGreeting,memberTrackingOrder} from '../../utils/memberHomePresentation';
import {withoutDeletedWebsites} from '../../utils/websiteDeletion';

function MemberDashboard(){
  const {user,sessionToken,openDataPage,setActivePage,openOrderStatus,openMysteryAi}=useApp();
  const [orders,setOrders]=useState<AuthenticatedCustomerOrderDetails[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(false),[retry,setRetry]=useState(0);
  const [website,setWebsite]=useState<MemberWebsiteSummary>();
  useEffect(()=>{
    let active=true;setLoading(true);setError(false);
    getAccountOrdersOnServer(sessionToken!,5).then(result=>{
      if(!result.success||!Array.isArray(result.orders))throw Error('Orders unavailable');
      if(active)setOrders(result.orders);
    }).catch(()=>{if(active)setError(true);}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[sessionToken,retry]);
  useEffect(()=>{
    // Existing Website Builder endpoint, read once after first paint; on failure the card stays generic.
    let active=true;
    const timer=window.setTimeout(()=>getMyWebsitesOnServer(sessionToken!).then(result=>{
      if(!active||!result.success||!Array.isArray(result.sites))return;
      const [site]=withoutDeletedWebsites(result.sites);
      setWebsite(!site?{state:'none'}:{state:site.status==='published'?'published':'draft',name:site.name,slug:site.slug});
    }).catch(()=>{}),600);
    return()=>{active=false;window.clearTimeout(timer);};
  },[sessionToken]);
  return <MemberHomeView name={user?.name.trim().split(/\s+/)[0]||'Member'} greeting={memberGreeting(new Date().getHours())} orders={orders} loading={loading} error={error} retry={()=>setRetry(x=>x+1)} track={o=>openOrderStatus(memberTrackingOrder(o))} wallet={<HomeWalletSummary compact/>} promotion={<InstallAppPromo variant="compact"/>} website={website} assistant={()=>openMysteryAi()} actions={{data:network=>openDataPage('data',network),airtime:network=>openDataPage('airtime',network),website:()=>setActivePage(website&&website.state!=='none'?'business':'website'),earn:()=>setActivePage('earn'),orders:()=>setActivePage('orders'),marketplace:()=>setActivePage('marketplace'),afa:()=>setActivePage('afa'),services:()=>setActivePage('services')}}/>;
}
export const MemberHome:React.FC=()=>{
  const {user,sessionToken}=useApp();
  // A different account gets a fresh dashboard; late responses from the old one are ignored.
  return user&&sessionToken?<MemberDashboard key={sessionToken}/>:null;
};
