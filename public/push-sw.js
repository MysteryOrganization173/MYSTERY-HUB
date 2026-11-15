/* Web Push only. No fetch interception, offline caches, account credentials or customer information. */
const ICON='https://res.cloudinary.com/da6oeat7m/image/upload/f_auto,q_auto,w_192,h_192,c_pad,b_rgb:070b0e/v1790859552/30338777-d9dc-4709-8603-b18a4dc8d0ca_tvptuc.png';
const ID=/^[0-9a-f-]{36}$/i;
const plain=(value,max)=>typeof value==='string'&&value.trim().length>0&&value.length<=max&&!/[<>\x00-\x1f]/.test(value);
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
 let data;try{data=event.data.json();}catch{return;}
 if(data?.version!==1||typeof data.notificationId!=='string'||!ID.test(data.notificationId))return;
 // Announcements (opted-in news and offers) show their own approved, non-personal text and open the app.
 // Account updates ignore any supplied text: details appear only through the app's signed-in inbox lookup.
 const announcement=data.kind==='announcement'&&plain(data.title,80)&&plain(data.body,240);
 event.waitUntil(self.registration.showNotification(announcement?data.title:'Mystery Hub',{
  body:announcement?data.body:'An account update is available. Sign in to view it.',tag:'mh-'+data.notificationId,icon:ICON,
  data:{notificationId:data.notificationId,kind:announcement?'announcement':'account'},renotify:false
 }));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();const id=event.notification.data?.notificationId;if(typeof id!=='string'||!ID.test(id))return;
 const target=event.notification.data?.kind==='announcement'?new URL('/',self.location.origin):new URL('/orders',self.location.origin);
 if(event.notification.data?.kind!=='announcement')target.searchParams.set('notification',id);
 event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{
  const existing=clients.find(c=>new URL(c.url).origin===target.origin&&!new URL(c.url).pathname.startsWith('/sites/'));
  if(existing){await existing.navigate(target.href);return existing.focus();}return self.clients.openWindow(target.href);
 }));
});
self.addEventListener('message',event=>{if(event.data?.type==='CLEAR_ACCOUNT_NOTIFICATIONS')event.waitUntil(self.registration.getNotifications().then(items=>items.filter(n=>n.tag.startsWith('mh-')&&n.data?.kind!=='announcement').forEach(n=>n.close())));});
