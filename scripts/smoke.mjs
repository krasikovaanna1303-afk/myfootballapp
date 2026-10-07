import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import express from 'express';
import { chromium } from 'playwright';
import { openDatabase } from '../server/database.js';
import { createApp } from '../server/app.js';

const db=openDatabase(':memory:');const app=createApp(db);
app.use(express.static(resolve('dist')));app.get('/{*path}',(req,res)=>res.sendFile(resolve('dist/index.html')));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const url=`http://127.0.0.1:${server.address().port}`;
const executable=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||['/usr/bin/chromium','/usr/bin/chromium-browser','/usr/bin/google-chrome'].find(existsSync);
let browser;const errors=[];
async function waitFor(fn,message){const start=Date.now();while(Date.now()-start<8000){if(await fn())return;await new Promise(r=>setTimeout(r,80));}throw new Error(message);}
async function register(page,name,email){await page.getByRole('button',{name:'Регистрация',exact:true}).click();await page.getByLabel('Как тебя зовут').fill(name);await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Пароль',{exact:true}).fill('browser-test-password');await page.getByRole('button',{name:'Создать аккаунт',exact:true}).click();await waitFor(async()=>await page.locator('.modal').count()===0,'Registration did not close');}
try{
  browser=await chromium.launch({executablePath:executable,headless:true,args:['--no-sandbox']});
  const ctx=await browser.newContext({viewport:{width:1440,height:1080}}),page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);await page.locator('.pitch-card').first().waitFor();assert.equal(await page.locator('.pitch-card').count(),6);
  await page.getByLabel('Выбрать город').selectOption('moscow');assert.match(await page.locator('.pitch-card').first().innerText(),/Парк Горького/);
  await page.getByLabel('Выбрать город').selectOption('spb');
  await page.getByLabel('Поиск поля').fill('Таврическом');assert.equal(await page.locator('.pitch-card').count(),1);await page.getByRole('button',{name:'Очистить поиск',exact:true}).click();
  await page.getByRole('button',{name:'Бесплатные',exact:true}).click();assert.equal(await page.locator('.pitch-card').count(),5);
  await page.getByRole('button',{name:'С освещением',exact:true}).click();assert.equal(await page.locator('.pitch-card').count(),4);
  await page.getByRole('button',{name:/Все поля/}).click();
  await page.getByRole('button',{name:'Фильтры',exact:true}).click();await page.getByLabel('Формат игры').selectOption('7 × 7');await page.getByRole('button',{name:'Показать поля'}).click();assert.equal(await page.locator('.pitch-card').count(),2);
  await page.getByRole('button',{name:'Фильтры',exact:true}).click();await page.getByRole('button',{name:'Сбросить',exact:true}).click();await page.getByRole('button',{name:'Показать поля'}).click();
  await page.getByRole('button',{name:'Показать на карте'}).click();await page.locator('.pitch-marker').first().waitFor();assert.equal(await page.locator('.pitch-marker').count(),6);
  await page.locator('.pitch-marker').first().click();await page.getByRole('dialog').waitFor();await page.getByRole('button',{name:'Закрыть',exact:true}).click();
  await page.getByRole('button',{name:'Показать списком'}).click();
  await page.screenshot({path:'/tmp/kasanie-desktop-verified.png',fullPage:true});
  console.log('PASS catalog: cities, search, price/lighting/format filters, interactive map and pitch cards');
  await page.locator('.topbar').getByRole('button',{name:'Войти',exact:true}).click();await register(page,'Тест Игрок','browser-owner@example.test');
  await page.locator('.pitch-card').first().getByRole('button',{name:'В избранное',exact:true}).click();await page.locator('.toast').waitFor();
  await page.locator('.sidebar').getByRole('button',{name:'Избранное',exact:true}).click();assert.equal(await page.locator('.pitch-card').count(),1);
  await page.locator('.pitch-heading button').first().click();await page.getByLabel('Твой отзыв').fill('Проверка браузером: хорошее покрытие и освещение.');await page.getByRole('button',{name:'Опубликовать отзыв'}).click();await page.getByText('Проверка браузером: хорошее покрытие и освещение.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Создать игру',exact:true}).click();await page.getByLabel('Название игры').fill('Тестовая игра команды');await page.getByLabel('Всего участников').fill('6');await page.getByLabel('Твоя группа, включая тебя').fill('2');await page.getByLabel('Подробности').fill('Берите футболки и хорошее настроение.');await page.getByRole('button',{name:'Опубликовать игру',exact:true}).click();await waitFor(async()=>await page.locator('.modal').count()===0,'Game form did not close');
  await page.locator('.sidebar').getByRole('button',{name:/Мои игры/}).click();await page.getByRole('button',{name:'Тестовая игра команды',exact:true}).waitFor();assert.match(await page.locator('.game-card').innerText(),/2 из 6/);
  console.log('PASS account: registration, session, saved field, review, game creation with group size');
  const ctx2=await browser.newContext({viewport:{width:1280,height:900}}),guest=await ctx2.newPage();guest.on('pageerror',e=>errors.push(e.message));await guest.goto(url);await guest.locator('.pitch-card').first().waitFor();await guest.locator('.sidebar').getByRole('button',{name:'Найти игру',exact:true}).click();await guest.getByRole('button',{name:'Тестовая игра команды',exact:true}).click();await guest.getByRole('button',{name:'Присоединиться к игре',exact:true}).click();await register(guest,'Другой Игрок','browser-guest@example.test');await waitFor(async()=>/Ты в команде/.test(await guest.locator('.toast').innerText().catch(()=>'')),'Pending join after registration did not finish');
  await guest.locator('.sidebar').getByRole('button',{name:/Мои игры/}).click();await guest.locator('.game-card').waitFor();assert.match(await guest.locator('.game-card').innerText(),/3 из 6/);await guest.getByRole('button',{name:'Тестовая игра команды',exact:true}).click();await guest.getByRole('button',{name:'Не смогу участвовать',exact:true}).click();await guest.getByText('Первая игра ещё впереди',{exact:true}).waitFor();
  console.log('PASS multiplayer: another account joins, takes a seat and leaves');
  await page.locator('.topbar').getByRole('button',{name:'Добавить поле',exact:true}).click();await page.getByLabel('Название поля').fill('Новое поле сообщества');await page.getByLabel('Район',{exact:true}).fill('Центральный');await page.getByLabel('Адрес',{exact:true}).fill('Тестовая улица, 25');await page.getByLabel('Широта').fill('59.95');await page.getByLabel('Долгота').fill('30.35');await page.getByLabel('Вечернее освещение').check();await page.getByLabel('Что стоит знать').fill('Поле добавлено участником сообщества.');await page.getByRole('dialog').getByRole('button',{name:'Добавить поле',exact:true}).click();await waitFor(async()=>await page.locator('.modal').count()===0,'Pitch form did not close');await page.locator('.sidebar').getByRole('button',{name:'Найти поле',exact:true}).click();await page.getByRole('button',{name:'Новое поле сообщества',exact:true}).waitFor();assert.equal(await page.locator('.pitch-card').count(),7);
  await page.locator('.sidebar').getByRole('button',{name:/Футбольные выезды/}).click();await page.getByRole('button',{name:'Создать выезд',exact:true}).click();await page.getByLabel('Название выезда').fill('Поездка тестовой команды');await page.getByLabel('Куда едем').fill('Волхов');await page.getByLabel('Твоя группа, включая тебя').fill('2');await page.getByLabel('План поездки').fill('Едем в маленький город, играем и гуляем.');await page.getByRole('dialog').getByRole('button',{name:'Создать выезд',exact:true}).click();await waitFor(async()=>await page.locator('.modal').count()===0,'Trip form did not close');await page.getByRole('button',{name:'Поездка тестовой команды',exact:true}).waitFor();await page.locator('.sidebar').getByRole('button',{name:/Мои игры/}).click();await page.getByRole('button',{name:/Мои выезды/}).click();await page.getByRole('button',{name:'Поездка тестовой команды',exact:true}).waitFor();
  console.log('PASS community: submit a pitch with amenities and create a countryside trip');
  await page.reload();await page.locator('.pitch-card').first().waitFor();assert.match(await page.locator('.top-user').innerText(),/Тест/);await page.locator('.sidebar').getByRole('button',{name:/Мои игры/}).click();await page.getByRole('button',{name:/Мои выезды/}).click();await page.getByRole('button',{name:'Поездка тестовой команды',exact:true}).waitFor();
  const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});mobile.on('pageerror',e=>errors.push(e.message));await mobile.goto(url);await mobile.locator('.pitch-card').first().waitFor();await mobile.screenshot({path:'/tmp/kasanie-mobile-verified.png',fullPage:true});assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Mobile horizontal overflow');
  await mobile.getByRole('button',{name:'Открыть меню'}).click();await mobile.locator('.sidebar').getByRole('button',{name:/Футбольные выезды/}).click();await mobile.locator('.trip-card').first().waitFor();assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Trip page mobile horizontal overflow');
  await mobile.locator('.trip-card').first().getByRole('button',{name:'Посмотреть выезд'}).click();await mobile.getByRole('dialog').waitFor();await mobile.screenshot({path:'/tmp/kasanie-mobile-trip.png'});await mobile.getByRole('button',{name:'Закрыть',exact:true}).click();
  assert.deepEqual(errors,[]);console.log('PASS mobile: responsive catalog, navigation, trips, accessible dialogs; no browser runtime errors');
}finally{await browser?.close();await new Promise(r=>server.close(r));db.close();}
