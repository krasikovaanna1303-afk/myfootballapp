import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomBytes, scryptSync } from 'node:crypto';

export function openDatabase(path = process.env.DATABASE_PATH || './data/kasanie.sqlite') {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS pitches (id INTEGER PRIMARY KEY, name TEXT NOT NULL, city TEXT NOT NULL, address TEXT NOT NULL, district TEXT NOT NULL, surface TEXT NOT NULL, format TEXT NOT NULL, price INTEGER NOT NULL DEFAULT 0, lighting INTEGER NOT NULL, changing_room INTEGER NOT NULL DEFAULT 0, parking INTEGER NOT NULL DEFAULT 0, lat REAL NOT NULL, lng REAL NOT NULL, description TEXT NOT NULL, owner_id INTEGER REFERENCES users(id), demo INTEGER NOT NULL DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS games (id INTEGER PRIMARY KEY, pitch_id INTEGER NOT NULL REFERENCES pitches(id), owner_id INTEGER NOT NULL REFERENCES users(id), title TEXT NOT NULL, starts_at TEXT NOT NULL, duration INTEGER NOT NULL, capacity INTEGER NOT NULL, level TEXT NOT NULL, price INTEGER NOT NULL DEFAULT 0, description TEXT NOT NULL, demo INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS game_members (game_id INTEGER REFERENCES games(id) ON DELETE CASCADE, user_id INTEGER REFERENCES users(id), seats INTEGER NOT NULL, PRIMARY KEY(game_id,user_id));
    CREATE TABLE IF NOT EXISTS trips (id INTEGER PRIMARY KEY, owner_id INTEGER NOT NULL REFERENCES users(id), title TEXT NOT NULL, destination TEXT NOT NULL, city TEXT NOT NULL, starts_at TEXT NOT NULL, capacity INTEGER NOT NULL, price INTEGER NOT NULL, description TEXT NOT NULL, demo INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS trip_members (trip_id INTEGER REFERENCES trips(id) ON DELETE CASCADE, user_id INTEGER REFERENCES users(id), seats INTEGER NOT NULL, PRIMARY KEY(trip_id,user_id));
    CREATE TABLE IF NOT EXISTS reviews (id INTEGER PRIMARY KEY, pitch_id INTEGER NOT NULL REFERENCES pitches(id), user_id INTEGER NOT NULL REFERENCES users(id), rating INTEGER NOT NULL, text TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP, UNIQUE(pitch_id,user_id));
    CREATE TABLE IF NOT EXISTS favorites (pitch_id INTEGER REFERENCES pitches(id) ON DELETE CASCADE, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, PRIMARY KEY(pitch_id,user_id));`);
  if (!db.prepare('SELECT id FROM pitches LIMIT 1').get()) seed(db);
  return db;
}
export function hashPassword(password) { const salt = randomBytes(16).toString('hex'); return `${salt}:${scryptSync(password,salt,64).toString('hex')}`; }
function seed(db) {
  const names=['Алексей М.','Денис К.','Михаил С.','Аня Л.','Иван П.','Саша В.'];
  const addUser=db.prepare('INSERT INTO users(name,email,password) VALUES(?,?,?)');
  for(let i=0;i<names.length;i++) addUser.run(names[i],`seed-${i}@example.invalid`,hashPassword(randomBytes(32).toString('hex')));
  const pitches = [
    ['Поле в Таврическом саду','spb','Кирочная улица, 50','Центральный','Искусственный газон','5 × 5',0,1,0,0,59.9475,30.3758,'Уютное поле среди деревьев. Подходит для дружеских игр после работы.'],
    ['Парк 300-летия','spb','Приморский проспект, 74','Приморский','Искусственный газон','7 × 7',0,1,0,1,59.9832,30.2034,'Просторная площадка рядом с заливом. Берите ветровку: по вечерам бывает прохладно.'],
    ['Поле на Крестовском','spb','Крестовский проспект, 23','Петроградский','Натуральный газон','7 × 7',2500,1,1,1,59.9722,30.2688,'Зелёный остров, просторное поле и удобные раздевалки. Для игры может потребоваться бронирование у владельца.'],
    ['Московский парк Победы','spb','Кузнецовская улица, 25','Московский','Искусственный газон','5 × 5',0,0,0,1,59.8662,30.3272,'Небольшое поле для дневных игр в парке.'],
    ['Поле у Лесной','spb','Полюстровский проспект, 59','Выборгский','Резиновое покрытие','5 × 5',0,1,0,0,59.9862,30.3541,'Районная спортивная площадка для небольших команд.'],
    ['Парк Сосновка','spb','Светлановский проспект, 44','Выборгский','Натуральный газон','11 × 11',0,0,0,1,60.0213,30.3441,'Большое поле рядом с лесопарком. Хорошее место для воскресного футбола.'],
    ['Парк Горького','moscow','Крымский Вал, 9','Якиманка','Искусственный газон','5 × 5',2000,1,1,0,55.7301,37.6013,'Футбол в центре города. Запланируйте время на прогулку после матча.'],
    ['Лужники · малое поле','moscow','Лужнецкая набережная, 24','Хамовники','Искусственный газон','7 × 7',4000,1,1,1,55.7174,37.5537,'Площадка в спортивном районе. Бронирование и текущую цену уточняйте отдельно.'],
    ['Парк «Сокольники»','moscow','Сокольнический Вал, 1','Сокольники','Натуральный газон','7 × 7',0,1,0,1,55.7971,37.6752,'Любительский футбол в окружении парка.'],
    ['Поле на ВДНХ','moscow','Проспект Мира, 119','Останкинский','Искусственный газон','5 × 5',1500,1,1,1,55.8307,37.6235,'Компактное поле для коротких вечерних матчей.'],
    ['Парк Фили','moscow','Большая Филёвская улица, 22','Филёвский парк','Резиновое покрытие','5 × 5',0,0,0,0,55.7451,37.4795,'Районная площадка рядом с зелёными прогулочными маршрутами.'],
    ['Мещерский парк','moscow','Воскресенская улица, 3','Солнцево','Натуральный газон','11 × 11',0,0,0,1,55.6672,37.4224,'Большое поле вдали от городского шума.']
  ];
  const insertPitch=db.prepare('INSERT INTO pitches(name,city,address,district,surface,format,price,lighting,changing_room,parking,lat,lng,description,demo) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,1)');
  pitches.forEach(p=>insertPitch.run(...p));
  const now=new Date();
  const date=(days,hour)=> { const d=new Date(now); d.setUTCDate(d.getUTCDate()+days); d.setUTCHours(hour-3,0,0,0); return d.toISOString(); };
  const addGame=db.prepare('INSERT INTO games(pitch_id,owner_id,title,starts_at,duration,capacity,level,price,description,demo) VALUES(?,?,?,?,?,?,?,?,?,1)');
  const addMember=db.prepare('INSERT INTO game_members VALUES(?,?,?)');
  const games=[[1,1,'Вечерний футбол без спешки',date(1,19),90,10,'Любой уровень',0,'Собираемся после работы. Играем в удовольствие, берите светлую и тёмную футболки.'],[2,2,'Игра у залива',date(2,18),90,14,'Средний',0,'Дружеский матч 7 на 7. Встречаемся за 15 минут до начала.'],[3,3,'Суббота на Крестовском',date(3,12),120,14,'Любой уровень',350,'Ищем ещё несколько игроков. Стоимость поля делим между участниками.'],[7,4,'Встречаемся в Парке Горького',date(1,19),90,10,'Любой уровень',200,'Можно прийти одному или с друзьями.'],[8,5,'Футбольный вечер в Лужниках',date(2,20),90,14,'Средний',400,'Спокойный дружеский футбол.'],[9,6,'Воскресный футбол в парке',date(4,12),120,14,'Любой уровень',0,'Отличный повод провести день на свежем воздухе.']];
  games.forEach((g,i)=>{const id=addGame.run(...g).lastInsertRowid;addMember.run(id,g[1],i%3===0?7:i%3===1?9:8);});
  const addTrip=db.prepare('INSERT INTO trips(owner_id,title,destination,city,starts_at,capacity,price,description,demo) VALUES(?,?,?,?,?,?,?,?,1)');
  [[1,'Футбол среди холмов','Старая Ладога','spb',date(10,10),12,1200,'Едем в Старую Ладогу: игра на деревенском поле, прогулка к крепости и пикник. Транспорт обсудим вместе.'],[2,'Матч у озера','Приозерск','spb',date(17,10),14,1800,'Выезд на один день. Футбол, свежий воздух и прогулка по небольшому городу.'],[4,'За город, за футболом','Переславль-Залесский','moscow',date(12,9),12,2200,'Поедем к Плещееву озеру. Поле и логистику подтверждает организатор перед поездкой.']].forEach((t,i)=>{const id=addTrip.run(...t).lastInsertRowid;db.prepare('INSERT INTO trip_members VALUES(?,?,?)').run(id,t[0],i===0?6:4);});
  const review=db.prepare('INSERT INTO reviews(pitch_id,user_id,rating,text) VALUES(?,?,?,?)');
  pitches.forEach((_,i)=>{review.run(i+1,1,5,'Хорошее место для футбола с друзьями.');review.run(i+1,2,i%3===0?5:4,'Удобно добираться, покрытие вполне комфортное.');});
}
