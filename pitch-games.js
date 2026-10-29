/* Games belong to individual pitches. Local prototype until shared backend is connected. */
(() => {
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const catalog=()=>[...fields,...(window.POLE_SEED_FIELDS||[]),...(window.POLE_PERMANENT_FIELDS||[]),...osm];
const pitch=id=>catalog().find(f=>String(f.id)===String(id));
const fmt=(date,time)=>{try{return new Date(date+'T'+time).toLocaleString('ru-RU',{day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'})}catch{return date+' '+time}};
const matches=(game,f)=>game.fieldId?String(game.fieldId)===String(f.id):game.field===f.name;
const upcoming=f=>games.filter(g=>matches(g,f) && new Date(g.date+'T'+(g.time||'00:00')).getTime()>=Date.now()-3600000)
.sort((a,b)=>(a.date+' '+a.time).localeCompare(b.date+' '+b.time));
function renderPitchGames(id){
 const f=pitch(id),target=document.querySelector('#pitch-games-list');
 if(!f||!target||target.dataset.pitch!==String(id))return;
 const found=upcoming(f);
 target.innerHTML=found.length?found.map(g=>{
  const n=g.attendees?.length||0,cap=Number(g.capacity)||0,joined=!!user&&g.attendees?.includes(user.id);
  return '<article class="pitch-game-item"><b>'+esc(g.title)+'</b><p>📅 '+esc(fmt(g.date,g.time))+' · '+n+'/'+cap+' игроков</p><p>'+esc(g.description||'')+'</p><button class="secondary" data-kind="game" data-join="'+esc(g.id)+'" '+(cap<=n&&!joined?'disabled':'')+'>'+(joined?'Отменить участие':cap<=n?'Мест нет':'Присоединиться')+'</button></article>';
 }).join(''):'<p class="notice">Здесь пока нет предстоящих игр. Создай первую!</p>';
}
const prior=window.showField;
window.showField=function(id){
 prior(id);
 const f=pitch(id),box=document.querySelector('#modal-inner');if(!f||!box)return;
 box.insertAdjacentHTML('beforeend','<section class="pitch-games"><h3>⚽ Игры на этой площадке</h3><p class="notice">Пока демонстрационный режим: игры и записи сохраняются только в текущем браузере, а не на устройствах остальных игроков.</p><div id="pitch-games-list" data-pitch="'+esc(id)+'"></div><button class="primary" id="pitch-create-game">+ Создать игру здесь</button></section>');
 renderPitchGames(id);
 const create=()=>{
   document.querySelector('#modal').close();
   add('game');
   const form=document.querySelector('#gameform');if(!form)return;
   const selector=form.elements.field;
   if(selector && ![...selector.options].some(o=>o.value===f.name))selector.add(new Option(f.name,f.name));
   if(selector)selector.value=f.name;
   if(form.elements.fieldId)form.elements.fieldId.value=String(f.id);
 };
 const btn=document.querySelector('#pitch-create-game');if(btn)btn.onclick=create;
 const older=document.querySelector('#field-game');if(older)older.onclick=create;
};
document.addEventListener('click',e=>{
 const join=e.target.closest('[data-join][data-kind="game"]');
 if(join){const id=document.querySelector('#pitch-games-list')?.dataset.pitch;if(id)setTimeout(()=>renderPitchGames(id),0)}
});
})();
