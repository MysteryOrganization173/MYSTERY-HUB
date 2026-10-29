import {useEffect} from 'react';
import {useApp} from '../../context/AppContext';
import {growthSession,trackGrowth} from '../../utils/growthAnalytics';
import {isInstalledApp} from '../../pwa/appEnvironment';
import type {GrowthPage} from '../../../shared/growthAnalytics';
/** Observation only. No payment outcome or customer content is read or submitted. */
export function GrowthTracker(){
 const {activePage,dataProductMode,user,sessionToken,isCheckoutOpen,checkoutBundle,marketplaceOverlay}=useApp();
 const page=(activePage==='data'&&dataProductMode!=='data'?dataProductMode:activePage) as GrowthPage;
 useEffect(()=>{growthSession(sessionToken,user?.id||null,user?.role==='admin');if(activePage==='admin')return;trackGrowth('page_view',{page});if(user&&sessionToken)trackGrowth('identity',{page});if(isInstalledApp())trackGrowth('standalone_launch',{page});},[page,user?.id,user?.role,sessionToken]);
 useEffect(()=>{if(isCheckoutOpen&&checkoutBundle)trackGrowth('checkout_opened',{page:checkoutBundle.serviceType==='airtime'?'airtime':checkoutBundle.serviceType==='instant_bundle'?'instant':'data'});},[isCheckoutOpen,checkoutBundle?.id]);
 useEffect(()=>{const o=marketplaceOverlay;if(o.kind==='none'||o.kind==='share')return;trackGrowth(o.kind==='checkout'?'checkout_opened':o.kind==='inquiry'?'marketplace_inquiry':'marketplace_product',{page:'marketplace',productId:o.product.id});},[marketplaceOverlay.kind,marketplaceOverlay.kind==='none'?'':marketplaceOverlay.product.id]);
 return null;
}
