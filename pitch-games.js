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
 target.innerHTML=found.length?found.map(g=>card(g,'game')).join(''):'<p class="notice">Здесь пока нет предстоящих игр. Создай первую!</p>';
}
const prior=window.showField;
window.showField=function(id){
 prior(id);
 const f=pitch(id),box=document.querySelector('#modal-inner');if(!f||!box)return;
 box.insertAdjacentHTML('beforeend','<section class="pitch-games"><h3>⚽ Игры на этой площадке</h3><p class="notice">'+(window.POLE_SUPABASE_CLIENT?'Игры видны всем пользователям. Для записи требуется вход в аккаунт.':'Демо: игры сохраняются только в текущем браузере, пока не подключена общая база.')+'</p><div id="pitch-games-list" data-pitch="'+esc(id)+'"></div><button class="primary" id="pitch-create-game">+ Создать игру здесь</button></section>');
 renderPitchGames(id);
 const create=()=>{
   document.querySelector('#modal').close();
   add('game');
   const form=document.querySelector('#gameform');if(!form)return;
   if(typeof window.POLE_SET_GAME_FIELD==='function')window.POLE_SET_GAME_FIELD(f);
   else{
    const selector=form.elements.field;
    if(selector?.tagName==='SELECT'){
     if(![...selector.options].some(o=>o.value===f.name))selector.add(new Option(f.name,f.name));
     selector.value=f.name;
    }
    if(form.elements.fieldId)form.elements.fieldId.value=String(f.id);
   }
 };
 const btn=document.querySelector('#pitch-create-game');if(btn)btn.onclick=create;
 const older=document.querySelector('#field-game');if(older){older.textContent='★ Оставить отзыв';older.classList.remove('primary');older.classList.add('secondary');older.onclick=()=>{const review=document.querySelector('[data-community-review]');if(review)review.click();else toast('Отзывы временно недоступны');};}
 const duplicate=document.querySelector('#field-review');if(duplicate)duplicate.remove();
};
document.addEventListener('pole-shared-games',()=>{const id=document.querySelector('#pitch-games-list')?.dataset.pitch;if(id)renderPitchGames(id)});
document.addEventListener('click',e=>{
 const join=e.target.closest('[data-join][data-kind="game"]');
 if(join){const id=document.querySelector('#pitch-games-list')?.dataset.pitch;if(id)setTimeout(()=>renderPitchGames(id),0)}
});
})();
