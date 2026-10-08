import React,{useEffect,useState} from 'react';
import {useApp} from '../../context/AppContext';
import {getAccountOrdersOnServer} from '../../services/apiClient';
import type {SafePublicOrderDetails} from '../../../server/types/orders';
import {HomeWalletSummary} from './HomeWalletSummary';
import {MemberHomeView} from './MemberHomeView';
import {memberGreeting,memberTrackingOrder} from '../../utils/memberHomePresentation';

function MemberDashboard(){
  const {user,sessionToken,openDataPage,setActivePage,openOrderStatus,openMysteryAi}=useApp();
  const [orders,setOrders]=useState<SafePublicOrderDetails[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(false),[retry,setRetry]=useState(0);
  useEffect(()=>{
    let active=true;setLoading(true);setError(false);
    getAccountOrdersOnServer(sessionToken!,5).then(result=>{
      if(!result.success||!Array.isArray(result.orders))throw Error('Orders unavailable');
      if(active)setOrders(result.orders);
    }).catch(()=>{if(active)setError(true);}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[sessionToken,retry]);
  return <MemberHomeView name={user?.name.trim().split(/\s+/)[0]||'Member'} greeting={memberGreeting(new Date().getHours())} orders={orders} loading={loading} error={error} retry={()=>setRetry(x=>x+1)} track={o=>openOrderStatus(memberTrackingOrder(o))} wallet={<HomeWalletSummary compact/>} assistant={()=>openMysteryAi()} actions={{data:()=>openDataPage('data'),airtime:()=>openDataPage('airtime'),website:()=>setActivePage('website'),earn:()=>setActivePage('earn'),orders:()=>setActivePage('orders'),marketplace:()=>setActivePage('marketplace'),afa:()=>setActivePage('afa'),services:()=>setActivePage('services')}}/>;
}
export const MemberHome:React.FC=()=>{
  const {user,sessionToken}=useApp();
  // A different account gets a fresh dashboard; late responses from the old one are ignored.
  return user&&sessionToken?<MemberDashboard key={sessionToken}/>:null;
};
