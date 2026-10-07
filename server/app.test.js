import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from './database.js';
import { createApp } from './app.js';

async function fixture(t){
  const db=openDatabase(':memory:');const server=createApp(db).listen(0,'127.0.0.1');
  await new Promise(r=>server.once('listening',r));
  t.after(()=>{server.close();db.close();});
  const base=`http://127.0.0.1:${server.address().port}/api`;
  async function req(path,{cookie,body,method=body?'POST':'GET'}={}){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
  async function register(email,name='Тестовый игрок'){const result=await req('/auth/register',{body:{name,email,password:'test-password-2026'}});assert.equal(result.status,200);return result;}
  return {db,req,register};
}
test('Registration, secure session, login, favorite, review and logout',async t=>{
  const {db,req,register}=await fixture(t);
  const unauth=await req('/games',{body:{}});assert.equal(unauth.status,401);
  const reg=await register('one@example.test');const uid=reg.data.user.id;
  assert.equal((await req('/me',{cookie:reg.cookie})).data.user.id,uid);
  assert.notEqual(db.prepare('SELECT password FROM users WHERE id=?').get(uid).password,'test-password-2026');
  assert.equal((await req('/auth/register',{body:{name:'Другой',email:'one@example.test',password:'test-password-2026'}})).status,409);
  assert.equal((await req('/auth/login',{body:{email:'one@example.test',password:'wrong'}})).status,401);
  const login=await req('/auth/login',{body:{email:'one@example.test',password:'test-password-2026'}});assert.equal(login.status,200);
  const cookie=login.cookie;
  assert.equal((await req('/pitches/1/favorite',{cookie,body:{}})).data.favorite,true);
  assert.equal((await req('/catalog',{cookie})).data.pitches.find(p=>p.id===1).favorite,1);
  assert.equal((await req('/pitches/1/favorite',{cookie,body:{}})).data.favorite,false);
  assert.equal((await req('/pitches/1/reviews',{cookie,body:{rating:4,text:'Хорошее поле, свет работает.'}})).status,200);
  assert.equal((await req('/pitches/1/reviews',{cookie,body:{rating:5,text:'Дополненный отзыв, всё отлично.'}})).status,200);
  const reviews=(await req('/pitches/1/reviews')).data.reviews.filter(r=>r.user_id===uid);assert.equal(reviews.length,1);assert.equal(reviews[0].rating,5);
  await req('/auth/logout',{cookie,body:{}});assert.equal((await req('/me',{cookie})).data.user,null);
});
test('Pitch creation and meetings: group capacity, concurrent joins, leave and owner-only cancellation',async t=>{
  const {req,register}=await fixture(t);const owner=await register('owner@example.test');const a=await register('a@example.test');const b=await register('b@example.test');
  const pitch=await req('/pitches',{cookie:owner.cookie,body:{name:'Новое тестовое поле',city:'spb',address:'Лесная улица, 15',district:'Центральный',surface:'Искусственный газон',format:'5 × 5',price:0,lighting:true,changing_room:true,parking:false,lat:59.94,lng:30.32,description:'Проверенное поле рядом с остановкой.'}});assert.equal(pitch.status,201);
  const starts_at=new Date(Date.now()+86400000).toISOString();
  assert.equal((await req('/games',{cookie:owner.cookie,body:{pitch_id:pitch.data.id,title:'Слишком большая группа',starts_at,duration:90,capacity:3,seats:4,level:'Любой уровень',price:0,description:'Тестовое описание'}})).status,400);
  const game=await req('/games',{cookie:owner.cookie,body:{pitch_id:pitch.data.id,title:'Тестовый вечерний футбол',starts_at,duration:90,capacity:4,seats:2,level:'Любой уровень',price:0,description:'Берите форму и хорошее настроение.'}});assert.equal(game.status,201);
  const id=game.data.id;
  assert.equal((await req(`/games/${id}/join`,{cookie:a.cookie,body:{seats:3}})).status,409);
  const joins=await Promise.all([req(`/games/${id}/join`,{cookie:a.cookie,body:{seats:2}}),req(`/games/${id}/join`,{cookie:b.cookie,body:{seats:2}})]);assert.deepEqual(joins.map(r=>r.status).sort(),[200,409]);
  const winningCookie=joins[0].status===200?a.cookie:b.cookie;
  const catalog=await req('/catalog',{cookie:winningCookie});const stored=catalog.data.games.find(g=>g.id===id);assert.equal(stored.occupied,4);assert.equal(stored.joined,1);
  assert.equal((await req(`/games/${id}/join`,{cookie:winningCookie,body:{seats:1}})).status,409);
  assert.equal((await req(`/games/${id}`,{cookie:winningCookie,method:'DELETE'})).status,403);
  assert.equal((await req(`/games/${id}/leave`,{cookie:winningCookie,body:{}})).status,200);
  assert.equal((await req(`/games/${id}/leave`,{cookie:owner.cookie,body:{}})).status,400);
  assert.equal((await req(`/games/${id}`,{cookie:owner.cookie,method:'DELETE'})).status,200);
  assert.ok(!(await req('/catalog')).data.games.some(g=>g.id===id));
});
test('Trips: create, join with friends, leave and validate date',async t=>{
  const {req,register}=await fixture(t);const owner=await register('tripowner@example.test'),guest=await register('tripguest@example.test');
  const body={title:'Футбол в маленьком городе',destination:'Старая Ладога',city:'spb',starts_at:new Date(Date.now()+86400000*3).toISOString(),capacity:10,seats:3,price:1200,description:'Едем на машине, играем на поле и гуляем по городу.'};
  assert.equal((await req('/trips',{cookie:owner.cookie,body:{...body,starts_at:'2020-01-01'}})).status,400);
  const trip=await req('/trips',{cookie:owner.cookie,body});assert.equal(trip.status,201);
  assert.equal((await req(`/trips/${trip.data.id}/join`,{cookie:guest.cookie,body:{seats:2}})).status,200);
  const members=(await req(`/trips/${trip.data.id}/members`)).data.members;assert.equal(members.reduce((sum,m)=>sum+m.seats,0),5);
  const own=(await req('/catalog',{cookie:guest.cookie})).data.trips.find(t=>t.id===trip.data.id);assert.equal(own.joined,1);assert.equal(own.occupied,5);
  assert.equal((await req(`/trips/${trip.data.id}/leave`,{cookie:guest.cookie,body:{}})).status,200);
});
test('SQLite retains the account, session and created meeting after reconnecting',async t=>{
  const {mkdtempSync,rmSync}=await import('node:fs');const {tmpdir}=await import('node:os');const {join}=await import('node:path');
  const folder=mkdtempSync(join(tmpdir(),'kasanie-persistence-'));t.after(()=>rmSync(folder,{recursive:true,force:true}));
  const path=join(folder,'test.sqlite');let db=openDatabase(path);let server=createApp(db).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  let base=`http://127.0.0.1:${server.address().port}/api`;
  const registration=await fetch(base+'/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Сохраняемый игрок',email:'persistent@example.test',password:'persistent-password'})});assert.equal(registration.status,200);const cookie=registration.headers.get('set-cookie').split(';')[0];
  const creation=await fetch(base+'/games',{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify({pitch_id:1,title:'Игра после перезапуска',starts_at:new Date(Date.now()+86400000).toISOString(),duration:90,capacity:10,seats:3,level:'Любой уровень',price:0,description:'Встреча сохраняется после перезапуска сервера.'})});assert.equal(creation.status,201);const id=(await creation.json()).id;
  await new Promise(r=>server.close(r));db.close();
  db=openDatabase(path);server=createApp(db).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>{server.close();db.close();});base=`http://127.0.0.1:${server.address().port}/api`;
  const catalog=await (await fetch(base+'/catalog',{headers:{Cookie:cookie}})).json();assert.equal(catalog.user.name,'Сохраняемый игрок');const game=catalog.games.find(g=>g.id===id);assert.equal(game.occupied,3);assert.equal(game.joined,1);
});
