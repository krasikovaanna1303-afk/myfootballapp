/* ПОЛЕ: добровольная подписка на фоновые Web Push.
   VAPID закрытый ключ находится только в Supabase Edge Functions. */
(() => {
'use strict';
const sb=window.POLE_SUPABASE_CLIENT;
const config=window.POLE_SUPABASE||{};
if(!sb||!config.url)return;

const supported=!!(window.isSecureContext&&'serviceWorker' in navigator&&
 'PushManager' in window&&'Notification' in window);
const keyName=id=>'pole_push_enabled_'+id;
let uid=null,enabled=false,subscriptionBusy=false;
let registrationPromise=null,publicKeyPromise=null;
const url=config.url.replace(/\/+$/,'')+'/functions/v1/pole-web-push';
const state=()=>({supported,enabled});
window.POLE_PUSH_STATUS=state;
const updateUI=()=>document.dispatchEvent(new Event('pole-push-state'));

function registration(){
 if(!supported)throw new Error('Этот браузер пока не поддерживает фоновые push.');
 if(!registrationPromise)registrationPromise=navigator.serviceWorker.register('./pole-sw.js',{scope:'./'})
  .then(()=>navigator.serviceWorker.ready);
 return registrationPromise;
}
function publicKey(){
 if(!publicKeyPromise)publicKeyPromise=fetch(url,{cache:'no-store'}).then(async reply=>{
  const body=await reply.json().catch(()=>({}));
  if(!reply.ok||!body.publicKey)throw new Error('Сначала настрой VAPID-ключи и Edge Function в Supabase.');
  return body.publicKey;
 }).catch(err=>{publicKeyPromise=null;throw err});
 return publicKeyPromise;
}
function base64urlBytes(value){
 const encoded=String(value).replace(/-/g,'+').replace(/_/g,'/');
 const decoded=atob(encoded+'='.repeat((4-encoded.length%4)%4));
 return Uint8Array.from(decoded,x=>x.charCodeAt(0));
}
async function registerServerSubscription(sub){
 const data=sub.toJSON();
 if(!data.endpoint||!data.keys?.p256dh||!data.keys?.auth)throw new Error('Не удалось получить ключи подписки браузера.');
 const {error}=await sb.rpc('pole_register_push_subscription',{
  p_endpoint:data.endpoint,p_p256dh:data.keys.p256dh,p_auth_secret:data.keys.auth,
 });
 if(error)throw new Error(/pole_register_push_subscription|schema cache|PGRST202/i.test(error.message||'')
  ?'Сначала выполни SQL-файл background-web-push.sql в Supabase.':error.message);
}

async function unsubscribe({logout=false}={}){
 if(!supported)return;
 const previous=uid;
 const reg=await registration();
 const sub=await reg.pushManager.getSubscription();
 if(sub){
  if(previous){
   const {error}=await sb.rpc('pole_unregister_push_subscription',{p_endpoint:sub.endpoint});
   if(error)console.warn('ПОЛЕ: подписка будет удалена на сервере при истечении',error.code||'rpc');
  }
  await sub.unsubscribe();
 }
 if(previous)localStorage.removeItem(keyName(previous));
 enabled=false;updateUI();
 if(!logout)toast('Фоновые уведомления выключены');
}

async function toggle(){
 if(!supported)throw new Error('Фоновые push недоступны в этом браузере. На iPhone сначала добавь ПОЛЕ на экран «Домой».');
 if(!uid)throw new Error('Сначала войди в аккаунт.');
 if(subscriptionBusy)return enabled;
 subscriptionBusy=true;
 try{
  if(enabled){await unsubscribe();return false}
  // Запрос разрешения запускается непосредственно после нажатия пользователем.
  const permission=await Notification.requestPermission();
  if(permission!=='granted')throw new Error('Разреши уведомления для ПОЛЯ в настройках браузера.');
  const [reg,key]=await Promise.all([registration(),publicKey()]);
  let sub=await reg.pushManager.getSubscription();
  const target=base64urlBytes(key);
  if(sub&&sub.options?.applicationServerKey){
   const old=new Uint8Array(sub.options.applicationServerKey);
   if(old.length!==target.length||old.some((v,i)=>v!==target[i])){
    await sub.unsubscribe();sub=null;
   }
  }
  if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:target});
  try{await registerServerSubscription(sub)}
  catch(error){await sub.unsubscribe();throw error}
  localStorage.setItem(keyName(uid),'1');
  // Старая схема уведомлений работала лишь в открытой вкладке.
  localStorage.removeItem('pole_browser_notify_'+uid);
  enabled=true;updateUI();toast('Фоновые push включены на этом устройстве');
  return true;
 }finally{subscriptionBusy=false}
}

window.POLE_PUSH_TOGGLE=toggle;
window.POLE_PUSH_BEFORE_LOGOUT=async()=>{
 try{await unsubscribe({logout:true})}
 catch(error){console.warn('ПОЛЕ: удаление push при выходе',error)}
};

async function syncUser(next){
 if(uid===next)return;
 uid=next;enabled=false;updateUI();
 if(!supported)return;
 try{
  const reg=await registration();
  const sub=await reg.pushManager.getSubscription();
  if(uid!==next)return;
  if(!sub)return;
  if(!next){await sub.unsubscribe();return}
  if(localStorage.getItem(keyName(next))==='1'&&Notification.permission==='granted'){
   try{await registerServerSubscription(sub);enabled=true}
   catch(error){console.warn('ПОЛЕ: отложена перерегистрация push',error)}
  }else{
   // На общем устройстве не оставляем подписку предыдущего аккаунта.
   await sub.unsubscribe();
  }
  updateUI();
 }catch(error){console.warn('ПОЛЕ: service worker недоступен',error)}
}
sb.auth.onAuthStateChange((_event,session)=>setTimeout(()=>syncUser(session?.user?.id||null),0));
sb.auth.getSession().then(({data})=>syncUser(data?.session?.user?.id||null));
})();
