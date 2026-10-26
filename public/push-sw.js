/* Web Push only. No fetch interception, offline caches, account credentials or customer information. */
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
 let data;try{data=event.data.json();}catch{return;}
 if(data?.version!==1||typeof data.notificationId!=='string'||!/^[0-9a-f-]{36}$/i.test(data.notificationId))return;
 // Ignore caller-supplied title/body/destination. Authentication occurs in the app's private inbox lookup.
 event.waitUntil(self.registration.showNotification('Mystery Hub',{
  body:'An account update is available. Sign in to view it.',tag:'mh-'+data.notificationId,
  icon:'https://res.cloudinary.com/da6oeat7m/image/upload/f_auto,q_auto,w_192,h_192,c_pad,b_rgb:070b0e/v1790859552/30338777-d9dc-4709-8603-b18a4dc8d0ca_tvptuc.png',data:{notificationId:data.notificationId},renotify:false
 }));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();const id=event.notification.data?.notificationId;if(typeof id!=='string'||!/^[0-9a-f-]{36}$/i.test(id))return;
 const target=new URL('/orders',self.location.origin);target.searchParams.set('notification',id);
 event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{
  const existing=clients.find(c=>new URL(c.url).origin===target.origin&&!new URL(c.url).pathname.startsWith('/sites/'));
  if(existing){await existing.navigate(target.href);return existing.focus();}return self.clients.openWindow(target.href);
 }));
});
self.addEventListener('message',event=>{if(event.data?.type==='CLEAR_ACCOUNT_NOTIFICATIONS')event.waitUntil(self.registration.getNotifications().then(items=>items.filter(n=>n.tag.startsWith('mh-')).forEach(n=>n.close())));});
