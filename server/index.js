import { createApp } from './app.js';
import express from 'express';
import { resolve } from 'node:path';
const app=createApp();
if(process.env.NODE_ENV==='production'){
  app.use(express.static(resolve('dist')));
  app.get('/{*path}',(req,res)=>res.sendFile(resolve('dist/index.html')));
}else{
  const {createServer}=await import('vite');
  const vite=await createServer({server:{middlewareMode:true},appType:'spa'});
  app.use(vite.middlewares);
}
const port=Number(process.env.PORT||3000);
app.listen(port,'0.0.0.0',()=>console.log(`Касание: http://0.0.0.0:${port}`));
