/* Service Worker ПОЛЯ: получает Web Push, даже когда вкладка закрыта.
   Не кэширует сайт и не перехватывает сетевые запросы. */
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));

self.addEventListener('push',event=>{
 let data={};
 try{data=event.data?.json()||{}}catch{data={}}
 const validId=typeof data.id==='string'&&/^[0-9a-f-]{36}$/i.test(data.id);
 const url=new URL('./'+(validId?'?notice='+encodeURIComponent(data.id):''),self.registration.scope).href;
 const title=typeof data.title==='string'?data.title.slice(0,140):'Уведомление ПОЛЯ';
 const body=typeof data.body==='string'?data.body.slice(0,260):'Открой приложение, чтобы посмотреть.';
 event.waitUntil(self.registration.showNotification(title,{
  body,tag:validId?'pole-'+data.id:'pole-message',
  icon:new URL('pole-icon.svg',self.registration.scope).href,
  badge:new URL('pole-icon.svg',self.registration.scope).href,
  data:{url},
 }));
});

self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil((async()=>{
  const scope=self.registration.scope;
  const raw=event.notification.data?.url||scope;
  const target=new URL(raw,scope);
  if(target.origin!==self.location.origin||!target.href.startsWith(scope))return;
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const existing=windows.find(w=>w.url.startsWith(scope));
  if(existing){
   if(existing.navigate)await existing.navigate(target.href);
   if(existing.focus)await existing.focus();
   return;
  }
  if(self.clients.openWindow)await self.clients.openWindow(target.href);
 })());
});
