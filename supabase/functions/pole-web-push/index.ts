// Supabase Edge Function: безопасная фоновая отправка Web Push.
// Deploy: supabase functions deploy pole-web-push --no-verify-jwt
// Secrets: POLE_VAPID_JWKS, POLE_WEBHOOK_SECRET.
import { createClient } from 'npm:@supabase/supabase-js@2';
import * as webpush from 'jsr:@negrel/webpush@0.5.0';

const cors={
 'Access-Control-Allow-Origin':'*',
 'Access-Control-Allow-Methods':'GET,POST,OPTIONS',
 'Access-Control-Allow-Headers':'apikey,authorization,content-type,x-pole-webhook-secret',
 'Cache-Control':'no-store',
};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{
 status,headers:{...cors,'Content-Type':'application/json; charset=utf-8'},
});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Секрет сравниваем без раннего выхода по символам.
function equalSecret(given:string|null,expected:string|null){
 if(!given||!expected||given.length!==expected.length)return false;
 let different=0;
 for(let i=0;i<expected.length;i++)different|=given.charCodeAt(i)^expected.charCodeAt(i);
 return different===0;
}

// Не допускаем SSRF: webhook не должен отправлять запросы к произвольным URL.
function allowedPushEndpoint(endpoint:string){
 try{
  const url=new URL(endpoint);
  if(url.protocol!=='https:'||url.username||url.password||url.port)return false;
  const host=url.hostname.toLowerCase();
  return host==='fcm.googleapis.com'||
   host==='updates.push.services.mozilla.com'||
   host==='web.push.apple.com'||host.endsWith('.push.apple.com')||
   host.endsWith('.notify.windows.com')||host.endsWith('.wns.windows.com');
 }catch{return false}
}

type SubscriptionRow={id:string,endpoint:string,p256dh:string,auth_secret:string};
type NoticeRow={id:string,recipient_id:string,title:string,body:string,kind:string};
let appPromise:Promise<webpush.ApplicationServer>|null=null;
function applicationServer(){
 if(!appPromise)appPromise=(async()=>{
  const raw=Deno.env.get('POLE_VAPID_JWKS');
  if(!raw)throw new Error('POLE_VAPID_JWKS secret is not configured');
  const jwks=JSON.parse(raw);
  const vapidKeys=await webpush.importVapidKeys(jwks,{extractable:false});
  return webpush.ApplicationServer.new({
   contactInformation:'https://krasikovaanna1303-afk.github.io/myfootballapp/',vapidKeys,
  });
 })();
 return appPromise;
}

Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method==='GET'){
  try{
   const raw=Deno.env.get('POLE_VAPID_JWKS');
   if(!raw)return json({error:'Фоновые push пока не настроены в Supabase'},503);
   const keys=await webpush.importVapidKeys(JSON.parse(raw),{extractable:false});
   return json({publicKey:await webpush.exportApplicationServerKey(keys)});
  }catch(err){console.warn('ПОЛЕ: VAPID configuration invalid',String(err));return json({error:'Ошибка конфигурации push'},503)}
 }
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 if(!equalSecret(req.headers.get('x-pole-webhook-secret'),Deno.env.get('POLE_WEBHOOK_SECRET'))){
  return json({error:'Unauthorized'},401);
 }

 let event:any;
 try{event=await req.json()}catch{return json({error:'Invalid JSON'},400)}
 if(event?.type!=='INSERT'||event?.table!=='pole_notifications'||event?.schema!=='public'||
    !uuid.test(String(event?.record?.id||'')))return json({error:'Invalid notification event'},400);

 const url=Deno.env.get('SUPABASE_URL');
 const role=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!role)return json({error:'Supabase service credentials unavailable'},503);
 const admin=createClient(url,role,{auth:{persistSession:false,autoRefreshToken:false}});

 // Повторно читаем событие из базы: нельзя доверять полям тела webhook.
 const {data:notification,error:readError}=await admin.from('pole_notifications')
  .select('id,recipient_id,title,body,kind').eq('id',event.record.id).maybeSingle();
 if(readError){console.error('ПОЛЕ: notification lookup failed',readError.code);return json({error:'Database query failed'},500)}
 if(!notification)return json({error:'Notification no longer exists'},404);

 const {data:devices,error:devicesError}=await admin.from('pole_push_subscriptions')
  .select('id,endpoint,p256dh,auth_secret')
  .eq('user_id',(notification as NoticeRow).recipient_id).limit(10);
 if(devicesError){console.error('ПОЛЕ: push subscription lookup failed',devicesError.code);return json({error:'Database query failed'},500)}
 if(!devices?.length)return json({ok:true,delivered:0,subscribers:0});

 let server:webpush.ApplicationServer;
 try{server=await applicationServer()}
 catch(err){console.error('ПОЛЕ: VAPID configuration error',String(err));return json({error:'Push server not configured'},503)}

 const row=notification as NoticeRow;
 const payload=JSON.stringify({id:row.id,title:row.title,body:row.body,kind:row.kind});
 let delivered=0,invalid=0;
 await Promise.all((devices as SubscriptionRow[]).map(async device=>{
  if(!allowedPushEndpoint(device.endpoint)){invalid++;return}
  try{
   await server.subscribe({
    endpoint:device.endpoint,keys:{auth:device.auth_secret,p256dh:device.p256dh},
   }).pushTextMessage(payload,{ttl:86400});
   delivered++;
  }catch(err){
   const gone=err instanceof webpush.PushMessageError&&err.isGone();
   const status=(err as {response?:{status?:number}})?.response?.status;
   if(gone||status===404||status===410){
    invalid++;
    await admin.from('pole_push_subscriptions').delete().eq('id',device.id);
   }else console.warn('ПОЛЕ: push failed',status||'network_error');
  }
 }));
 return json({ok:true,delivered,invalid,subscribers:devices.length});
});
