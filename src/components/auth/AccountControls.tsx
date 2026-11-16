import React, { useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { SecurityDialog } from './SecurityDialog';
import { NotificationSettings } from './NotificationSettings';
import { PasswordForm } from './PasswordForm';
import { MyAccountHub } from './MyAccountHub';
import { openNotificationCenter } from '../notifications/NotificationCenter';
import { afterOverlayHistory } from '../../utils/overlayHistory';
import {readNotificationInbox} from '../../services/customerNotifications';
import type { ActivePage } from '../../types';

/** The page a notification opens: Orders for an account update, or the approved page an announcement names. */
const NOTIFICATION_PAGES: Record<string, ActivePage> = { '/orders': 'orders', '/data': 'data', '/services': 'services', '/marketplace': 'marketplace', '/earn': 'earn' };
export const notificationPage = (destination: string): ActivePage => NOTIFICATION_PAGES[destination] ?? 'home';

export function AccountControls() {
  const { user,sessionToken,openAuth,showToast,setActivePage, isAccountOpen, isAuthChecking, closeAccount } = useApp();
  useEffect(()=>{
    const url=new URL(window.location.href),id=url.searchParams.get('notification'),open=url.searchParams.get('open');
    if(!id||isAuthChecking||user?.mustChangePassword||url.pathname.startsWith('/sites/'))return;
    if(!sessionToken){openAuth('login','Sign in to view your notification.');return;}
    const controller=new AbortController();
    void readNotificationInbox(sessionToken,id,controller.signal,open).then(n=>{
      if(controller.signal.aborted)return;
      url.searchParams.delete('notification');url.searchParams.delete('open');window.history.replaceState({},'',url.pathname+url.search+url.hash);
      showToast(`${n.title}: ${n.body}`,'info','notification');setActivePage(notificationPage(n.opens??n.destination));
    }).catch(()=>{if(!controller.signal.aborted){url.searchParams.delete('notification');url.searchParams.delete('open');window.history.replaceState({},'',url.pathname+url.search+url.hash);showToast('This notification is not available for the signed-in account.','info','notification');}});
    return ()=>controller.abort();
  },[sessionToken,user?.id,user?.mustChangePassword,isAuthChecking]);
  useEffect(()=>{if('serviceWorker' in navigator)void navigator.serviceWorker.getRegistration('/').then(r=>r?.active?.postMessage({type:'CLEAR_ACCOUNT_NOTIFICATIONS'})).catch(()=>{});},[sessionToken]);
  if (user?.mustChangePassword) return <SecurityDialog title="Create a new password" mandatory><PasswordForm forced /></SecurityDialog>;
  if (isAuthChecking) return <SecurityDialog title="Checking your session" mandatory><p>Please wait…</p></SecurityDialog>;
  if (!user || !isAccountOpen) return null;
  // 3.4.1: My Account is a sheet of short sections; notification settings live in its Notifications section, and
  // recent notifications in the Notification Center (the bell), reached from here in one tap.
  return <MyAccountHub key={user.id} notifications={<NotificationSettings key={sessionToken!} token={sessionToken!} accountId={user.id} embedded onShowRecent={() => { closeAccount(); afterOverlayHistory('mhAccount', openNotificationCenter); }} />} />;
}
