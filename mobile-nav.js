/* Отдельная боковая навигация для телефонов; десктопное меню не меняется. */
(() => {
 'use strict';
 const toggle=document.querySelector('#menu-toggle');
 const nav=document.querySelector('#main-nav');
 const close=document.querySelector('#menu-close');
 const backdrop=document.querySelector('#mobile-nav-backdrop');
 if(!toggle||!nav||!backdrop)return;
 const mobile=window.matchMedia('(max-width: 820px)');
 const setOpen=(wanted,restoreFocus=false)=>{
   const opened=!!wanted&&mobile.matches;
   document.body.classList.toggle('mobile-menu-open',opened);
   toggle.setAttribute('aria-expanded',String(opened));
   toggle.setAttribute('aria-label',opened?'Закрыть меню':'Открыть меню');
   backdrop.hidden=!opened;
   nav.inert=mobile.matches&&!opened;
   if(mobile.matches)nav.setAttribute('aria-hidden',String(!opened));
   else nav.removeAttribute('aria-hidden');
   if(opened)close?.focus();
   else if(restoreFocus&&mobile.matches)toggle.focus();
 };
 toggle.addEventListener('click',()=>setOpen(!document.body.classList.contains('mobile-menu-open')));
 close?.addEventListener('click',()=>setOpen(false,true));
 backdrop.addEventListener('click',()=>setOpen(false,true));
 nav.addEventListener('click',event=>{
   if(event.target.closest('[data-view]'))setOpen(false,false);
 });
 document.addEventListener('keydown',event=>{
   if(event.key==='Escape'&&document.body.classList.contains('mobile-menu-open')){
     event.preventDefault();
     setOpen(false,true);
   }
 });
 if(mobile.addEventListener)mobile.addEventListener('change',()=>setOpen(false));
 else mobile.addListener(()=>setOpen(false));
 setOpen(false);
})();
