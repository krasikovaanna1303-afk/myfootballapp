const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function workerHarness(){
 const handlers={};const shown=[],opened=[];
 const app='https://example.com/myfootballapp/';
 const client={url:app,async navigate(url){opened.push(url)},async focus(){opened.push('focused')}};
 const self={
  location:{origin:'https://example.com'},
  registration:{scope:app,async showNotification(title,options){shown.push({title,...options})}},
  clients:{async claim(){},async matchAll(){return [client]},async openWindow(url){opened.push(url)}},
  skipWaiting(){},
  addEventListener(type,fn){handlers[type]=fn},
 };
 vm.runInNewContext(fs.readFileSync('pole-sw.js','utf8'),{self,URL,encodeURIComponent});
 return {handlers,shown,opened,app};
}

test('push shows a notification with a scoped link',async()=>{
 const {handlers,shown,app}=workerHarness();
 const id='11111111-2222-4333-8444-555555555555';
 let pending;
 handlers.push({data:{json:()=>({id,title:'Новый участник',body:'Твоя игра'})},waitUntil(p){pending=p}});
 await pending;
 assert.equal(shown[0].title,'Новый участник');
 assert.equal(shown[0].body,'Твоя игра');
 assert.equal(shown[0].data.url,app+'?notice='+id);
});

test('click opens the app and prevents external destinations',async()=>{
 const {handlers,opened,app}=workerHarness();
 let pending;
 handlers.notificationclick({notification:{data:{url:app+'?notice=123'},close(){}},waitUntil(p){pending=p}});
 await pending;
 assert.deepEqual(opened,[app+'?notice=123','focused']);
 opened.length=0;
 handlers.notificationclick({notification:{data:{url:'https://evil.test/'},close(){}},waitUntil(p){pending=p}});
 await pending;
 assert.deepEqual(opened,[]);
});

test('manifest is installable and frontend includes push client',()=>{
 const manifest=JSON.parse(fs.readFileSync('manifest.webmanifest','utf8'));
 const html=fs.readFileSync('index.html','utf8');
 assert.equal(manifest.display,'standalone');
 assert.equal(manifest.scope,'./');
 assert.ok(html.includes('<script defer src="push-client.js"></script>'));
 assert.ok(html.indexOf('notifications.js')<html.indexOf('push-client.js'));
});
