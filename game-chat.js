/* ПОЛЕ: простой чат участников каждой игры. Сообщения хранятся в Supabase.
   Право чтения и отправки обеспечено RLS в community-messaging.sql. */
(() => {
'use strict';
const sb=window.POLE_SUPABASE_CLIENT;
if(!sb)return;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dialog=document.querySelector('#modal');
let active=null,interval=null,busy=false,lastSignature='',requestNumber=0;
const stop=()=>{
 if(interval){clearInterval(interval);interval=null}
 active=null;lastSignature='';requestNumber++;busy=false;
};
dialog?.addEventListener('close',()=>{if(!dialog.open)stop()});
const chatNotice=message=>{
 const node=document.querySelector('#pole-chat-status');
 if(node)node.textContent=message||'';
};
async function loadMessages(force=false){
 const chat=active;
 if(!chat||busy)return;
 busy=true;
 const request=++requestNumber;
 try{
  const {data,error}=await sb.from('pole_game_messages')
   .select('id,user_id,body,created_at')
   .eq('game_id',chat.id)
   .order('created_at',{ascending:false}).limit(100);
  if(error)throw error;
  if(!active||active.id!==chat.id||request!==requestNumber)return;
  const ordered=(data||[]).slice().reverse();
  const signature=ordered.map(m=>m.id).join('|');
  if(!force&&signature===lastSignature)return;
  lastSignature=signature;
  const root=document.querySelector('#pole-chat-messages');
  if(!root)return;
  const wasAtBottom=root.scrollHeight-root.scrollTop-root.clientHeight<90;
  const currentGame=games.find(g=>g.id===chat.id);
  const nicknames=new Map((currentGame?.players||[]).map(p=>[p.user_id,p.nickname]));
  root.innerHTML=ordered.length?ordered.map(m=>{
   const mine=m.user_id===chat.uid;
   const sender=mine?'Ты':nicknames.get(m.user_id)||(currentGame?.creator===m.user_id?currentGame?.organizer:null)||'Игрок';
   const timestamp=new Date(m.created_at).toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
   return '<article class="game-chat-message'+(mine?' mine':'')+'"><div class="game-chat-meta"><b>'+esc(sender)+'</b> · '+esc(timestamp)+'</div><p>'+esc(m.body)+'</p></article>';
  }).join(''):'<p class="notice">Сообщений пока нет. Напиши первым!</p>';
  if(wasAtBottom||force)root.scrollTop=root.scrollHeight;
  chatNotice('');
 }catch(error){
  if(active?.id!==chat.id)return;
  console.warn('ПОЛЕ: ошибка загрузки чата',error);
  chatNotice('Не удалось загрузить сообщения. Проверь, что SQL-обновление чата выполнено в Supabase. '+(error.message||''));
 }finally{
  busy=false;
 }
}
async function openGameChat(id){
 const game=games.find(g=>String(g.id)===String(id));
 if(!game)return toast('Игра не найдена. Обнови страницу.');
 const {data:{user:me}={},error:authError}=await sb.auth.getUser();
 if(authError||!me){toast('Для чата необходимо войти в аккаунт');document.querySelector('#account')?.click();return}
 const {data:membership,error:membershipError}=await sb.from('pole_game_members')
  .select('game_id').eq('game_id',id).eq('user_id',me.id).maybeSingle();
 if(membershipError){toast('Не удалось проверить участие в игре');return}
 if(!membership){toast('Чат доступен только тем, кто записался на игру');return}
 if(dialog?.open)dialog.close();
 stop();
 active={id,uid:me.id};
 const markup='<div class="game-chat-info">Чат видят и могут использовать только участники этой игры. Уточняйте место встречи, форму, время и другие детали.</div>'+
 '<div class="game-chat-messages" id="pole-chat-messages" role="log" aria-live="polite"><p class="notice">Загружаем сообщения…</p></div>'+
 '<p class="form-validation-message" id="pole-chat-status" role="alert"></p>'+
 '<form id="pole-game-chat-form"><label>Сообщение<textarea name="message" maxlength="1000" minlength="1" rows="2" required placeholder="Напиши участникам игры…"></textarea></label><button class="primary" type="submit">Отправить</button></form>'+
 '<p class="notice">Последние 100 сообщений обновляются автоматически примерно раз в 10 секунд.</p>';
 modal('Чат игры · '+game.title,markup);
 await loadMessages(true);
 if(active?.id===id)interval=setInterval(()=>{if(!document.hidden)loadMessages()},10000);
}
document.addEventListener('click',e=>{
 const btn=e.target.closest('[data-game-chat]');
 if(!btn)return;
 e.preventDefault();
 openGameChat(btn.dataset.gameChat).catch(err=>{console.warn('ПОЛЕ: ошибка чата',err);toast('Не удалось открыть чат')});
});
document.addEventListener('submit',async e=>{
 const form=e.target;if(form.id!=='pole-game-chat-form')return;
 e.preventDefault();
 if(!active)return;
 const body=String(form.elements.message?.value||'').trim();
 if(!body||body.length>1000){chatNotice('Введите сообщение от 1 до 1000 символов.');return}
 const chat=active,button=form.querySelector('button[type="submit"]');
 if(button){button.disabled=true;button.textContent='Отправляем…'}
 try{
  const {error}=await sb.from('pole_game_messages').insert({game_id:chat.id,user_id:chat.uid,body});
  if(error)throw error;
  if(active?.id!==chat.id)return;
  form.elements.message.value='';
  chatNotice('');
  lastSignature='';await loadMessages(true);
 }catch(err){
  console.warn('ПОЛЕ: ошибка отправки в чат',err);
  chatNotice('Не удалось отправить сообщение. '+(err.message||'Повтори попытку позже.'));
 }finally{
  if(button){button.disabled=false;button.textContent='Отправить'}
 }
});
window.POLE_OPEN_GAME_CHAT=openGameChat;
})();
