/* Supabase multiplayer: games, membership, posts, moderated feedback.
   Enabled only after setting public URL/key and running SQL migrations. */
(() => {
'use strict';
const sb=window.POLE_SUPABASE_CLIENT;
if(!sb){
  const el=document.querySelector('#game-list');
  if(el)el.insertAdjacentHTML('afterbegin','<p class="notice">Демо: общие игры пока не подключены. Для совместной игры нужна настройка Supabase.</p>');
  return;
}
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Keep connection problems visible instead of showing a disappearing toast every 30 seconds.
const backendErrors=new Map();
const backendStatus=document.createElement('div');
backendStatus.id='pole-backend-status';
backendStatus.setAttribute('role','alert');
backendStatus.hidden=true;
backendStatus.style.cssText='margin:12px auto;padding:12px 16px;max-width:960px;border:1px solid #d99b52;border-radius:12px;background:#fff4e6;color:#49301a;font-size:14px;line-height:1.5';
document.querySelector('header')?.after(backendStatus);
const updateBackendStatus=()=>{
  backendStatus.hidden=!backendErrors.size;
  if(!backendErrors.size)return;
  const lines=[...backendErrors].map(([where,err])=>where+': '+err).join(' | ');
  backendStatus.textContent='Не удалось загрузить данные общей базы. '+lines+'. Проверь подключение Supabase. Пришли этот текст, если нужна помощь.';
};
const errorNotice=(e,where='общая база')=>{
  const detail=[e?.message||'нет ответа от сервера',e?.code?'код '+e.code:''].filter(Boolean).join(' · ');
  backendErrors.set(where,detail);
  updateBackendStatus();
  console.warn('ПОЛЕ: ошибка Supabase ('+where+')',e);
};
const clearError=where=>{if(backendErrors.delete(where))updateBackendStatus()};
const auth=async()=>{const {data,error}=await sb.auth.getUser();if(error||!data?.user){toast('Войди в аккаунт для этого действия');document.querySelector('#account')?.click();return null}return data.user};
let currentUid=null,loading=false,lastFeedback=[];
const toGame=(g,people)=>({id:g.id,fieldId:g.field_id,field:g.field_name,title:g.title,date:g.game_date,time:g.game_time?.slice(0,5)||'',capacity:g.capacity,description:g.description,creator:g.creator_id,organizer:g.organizer,attendees:people.filter(p=>p.game_id===g.id).map(p=>p.user_id)});
async function refreshGames(){
 if(loading)return;loading=true;
 try{
   const {data:rows,error}=await sb.from('pole_games').select('*').gte('game_date',new Date(Date.now()-86400000).toISOString().slice(0,10)).order('game_date',{ascending:true}).limit(300);
   if(error)throw error;
   const ids=(rows||[]).map(x=>x.id);
   let people=[];
   if(ids.length){
     const reply=await sb.from('pole_game_members').select('game_id,user_id').in('game_id',ids).limit(30000);
     if(reply.error)throw reply.error;people=reply.data||[];
   }
   games=(rows||[]).map(x=>toGame(x,people));
   // Only authenticated users may see the game's participants' selected profile fields.
   // Profile emails and authentication details are never queried or exposed.
   const {data:sessionResult}=await sb.auth.getSession();
   if(sessionResult?.session?.user && ids.length){
     const {data:rosters,error:rosterError}=await sb.rpc('pole_game_rosters',{p_games:ids});
     if(rosterError){errorNotice(rosterError,'составы игр')}
     else{
       clearError('составы игр');
       const byGame=new Map();
       for(const player of rosters||[]){
         if(!byGame.has(player.game_id))byGame.set(player.game_id,[]);
         byGame.get(player.game_id).push(player);
       }
       for(const g of games)g.players=byGame.get(g.id)||[];
     }
   }else{
     clearError('составы игр');
     if(sessionResult?.session?.user)for(const g of games)g.players=[];
   }
   renderGames();
   document.dispatchEvent(new Event('pole-shared-games'));
   clearError('игры');
 }catch(e){errorNotice(e,'игры')}
 finally{loading=false}
}
async function refreshPosts(){
 try{
   const {data,error}=await sb.from('pole_posts').select('*').order('created_at',{ascending:false}).limit(200);
   if(error)throw error;
   window.POLE_SHARED_POSTS=(data||[]).map(p=>({id:p.id,type:p.type,title:p.title,city:p.city,date:p.event_date||'',description:p.description,author:p.author,created:p.created_at}));
   document.dispatchEvent(new Event('pole-shared-posts'));
   clearError('объявления');
 }catch(e){errorNotice(e,'объявления')}
}
async function refreshFeedback(){
 try{
   const {data,error}=await sb.from('pole_field_feedback').select('id,field_id,kind,surface,lighting,access,rating,message,author,status,created_at').eq('status','approved').order('created_at',{ascending:false}).limit(2500);
   if(error)throw error;
   lastFeedback=data||[];
   clearError('отзывы');
 }catch(e){errorNotice(e,'отзывы')}
}
function appendFeedback(fieldId){
 const box=document.querySelector('#modal-inner');if(!box)return;
 const f=lastFeedback.filter(p=>String(p.field_id)===String(fieldId));
 if(!f.length)return;
 box.insertAdjacentHTML('beforeend','<section class="shared-feedback"><h3>Проверенные модератором отзывы и уточнения</h3>'+f.map(p=>'<article class="pitch-game-item"><b>'+esc(p.author)+'</b> · '+(p.kind==='review'?'⭐ '+p.rating+'/5':'Уточнение данных')+'<p>'+esc(p.message)+'</p>'+(p.kind==='edit'?'<p class="muted">'+[p.surface, p.lighting?'Свет: '+p.lighting:'',p.access?'Доступ: '+p.access:''].filter(Boolean).map(esc).join(' · ')+'</p>':'')+'</article>').join('')+'</section>');
}
const previousShow=window.showField;
window.showField=function(id){previousShow(id);appendFeedback(id)};
async function saveGame(form){
 const u=await auth();if(!u)return;
 const d=Object.fromEntries(new FormData(form).entries());
 const all=[...fields,...(window.POLE_SEED_FIELDS||[]),...(window.POLE_PERMANENT_FIELDS||[]),...osm];
 const selected=all.find(f=>String(f.id)===d.fieldId)||all.find(f=>f.name===d.field);
 const fieldId=String(selected?.id||d.fieldId||'').trim();
 if(!fieldId){toast('Выбери площадку из каталога');return}
 if(d.unlimited!=='on'&&(!Number.isInteger(Number(d.capacity))||Number(d.capacity)<2||Number(d.capacity)>100)){toast('Укажи количество игроков от 2 до 100 или выбери «Без ограничений»');return}
 const payload={creator_id:u.id,field_id:fieldId,field_name:selected?.name||d.field,title:d.title.trim(),game_date:d.date,game_time:d.time,capacity:d.unlimited==='on'?null:Number(d.capacity),description:d.description||'',organizer:user?.name||u.user_metadata?.nickname||'Игрок'};
 const {data,error}=await sb.from('pole_games').insert(payload).select('id').single();
 if(error)throw error;
 const joined=await sb.rpc('pole_join_game',{p_game:data.id});
 if(joined.error)throw joined.error;
 document.querySelector('#modal')?.close();toast('Игра опубликована для всех пользователей');await refreshGames();
}
async function switchJoin(id){
 const u=await auth();if(!u)return;
 const item=games.find(x=>x.id===id);if(!item){await refreshGames();return}
 const method=item.attendees?.includes(u.id)?'pole_leave_game':'pole_join_game';
 const {error}=await sb.rpc(method,{p_game:id});if(error)throw error;
 await refreshGames();toast(method==='pole_join_game'?'Ты записан(а) на игру':'Участие отменено');
}
async function savePost(form){
 const u=await auth();if(!u)return;
 const d=Object.fromEntries(new FormData(form).entries());
 const {error}=await sb.from('pole_posts').insert({creator_id:u.id,type:d.type,title:d.title.trim(),city:d.city.trim(),event_date:d.date||null,description:d.description.trim(),author:user?.name||u.user_metadata?.nickname||'Игрок'});
 if(error)throw error;
 document.querySelector('#modal')?.close();toast('Объявление опубликовано для всех пользователей');await refreshPosts();
}
async function saveFeedback(form){
 const u=await auth();if(!u)return;
 const d=Object.fromEntries(new FormData(form).entries());
 const {error}=await sb.from('pole_field_feedback').insert({
  creator_id:u.id,field_id:d.fieldId,kind:d.kind,surface:d.surface||null,
  lighting:d.lighting||null,access:d.access||null,rating:d.kind==='review'?Number(d.rating):null,
  message:d.message.trim(),author:user?.name||u.user_metadata?.nickname||'Игрок',status:'pending'
 });
 if(error)throw error;
 document.querySelector('#modal')?.close();toast('Отправлено модератору. Пока отзыв не опубликован.');
}
document.addEventListener('submit',async e=>{
 const form=e.target;
 if(!['gameform','community-post-form','community-field-form'].includes(form.id))return;
 e.preventDefault();e.stopImmediatePropagation();
 const button=form.querySelector('button[type=submit],button.primary');
 if(button){button.disabled=true;button.dataset.previousText=button.textContent;button.textContent='Сохраняем…'}
 try{
  if(form.id==='gameform')await saveGame(form);
  if(form.id==='community-post-form')await savePost(form);
  if(form.id==='community-field-form')await saveFeedback(form);
 }catch(err){errorNotice(err)}
 finally{if(button){button.disabled=false;button.textContent=button.dataset.previousText||'Сохранить'}}
},true);
document.addEventListener('click',async e=>{
 const b=e.target.closest('[data-kind="game"][data-join]');
 if(!b)return;
 e.preventDefault();e.stopImmediatePropagation();
 b.disabled=true;
 try{await switchJoin(b.dataset.join)}catch(err){errorNotice(err);b.disabled=false}
},true);
async function moderatorScreen(){
 const me=await auth();if(!me)return;
 const {data:roles,error:roleError}=await sb.from('pole_moderators').select('user_id').eq('user_id',me.id);
 if(roleError||!roles?.length){toast('Доступ только для модераторов');return}
 const {data,error}=await sb.from('pole_field_feedback').select('*').eq('status','pending').order('created_at',{ascending:true}).limit(100);
 if(error)throw error;
 modal('Проверка заявок игроков','<p class="notice">Одобрение делает комментарий или уточнение видимым всем. Перед подтверждением проверь источник и содержание.</p><div id="pole-moderator-items">'+((data||[]).map(p=>'<article class="pitch-game-item"><p><b>'+esc(p.author)+'</b> · '+esc(p.field_id)+' · '+esc(p.kind)+'</p><p>'+esc(p.message)+'</p><p class="muted">'+esc([p.surface,p.lighting,p.access].filter(Boolean).join(' / '))+'</p><button class="secondary" data-mod-feedback="'+esc(p.id)+'" data-mod-decision="approved">Одобрить</button> <button class="secondary" data-mod-feedback="'+esc(p.id)+'" data-mod-decision="rejected">Отклонить</button></article>').join('')||'<p>Новых заявок нет.</p>')+'</div>');
}
const community=document.querySelector('#community-content');
if(community){
 const wrap=document.createElement('div');wrap.className='pole-mod-tools';wrap.innerHTML='<button class="secondary" id="pole-moderator-open" hidden>Модерация отзывов</button>';community.parentElement.appendChild(wrap);
 document.querySelector('#pole-moderator-open').onclick=()=>moderatorScreen().catch(errorNotice);
}
async function updateModeratorAccess(){
 const {data}=await sb.auth.getUser();const u=data?.user;currentUid=u?.id||null;
 const btn=document.querySelector('#pole-moderator-open');
 if(btn){
  const {data:r}=u?await sb.from('pole_moderators').select('user_id').eq('user_id',u.id):{data:[]};
  btn.hidden=!r?.length;
 }
 if(!u){games=[];renderGames()}
}
document.addEventListener('click',async e=>{
 const b=e.target.closest('[data-mod-feedback]');if(!b)return;
 b.disabled=true;
 try{
  const {error}=await sb.from('pole_field_feedback').update({status:b.dataset.modDecision,reviewed_at:new Date().toISOString()}).eq('id',b.dataset.modFeedback).eq('status','pending');
  if(error)throw error;
  await refreshFeedback();await moderatorScreen();
 }catch(err){errorNotice(err);b.disabled=false}
});
async function start(){await updateModeratorAccess();await Promise.all([refreshGames(),refreshPosts(),refreshFeedback()])}
sb.auth.onAuthStateChange(()=>setTimeout(()=>{updateModeratorAccess();refreshGames()},100));
start();
window.addEventListener('focus',()=>{refreshGames();refreshPosts();refreshFeedback()});
setInterval(()=>{if(!document.hidden){refreshGames();refreshPosts();refreshFeedback()}},30000);
})();
