// Просмотр локальной БД: показывает зарегистрированных пользователей и сессии.
// Запуск: node view.mjs   (или npm run view)  из папки server/.
// Сам файл базы: server/katovape.db (открой любым SQLite-браузером для GUI).
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const file = join(here, 'katovape.db');
let db;
try { db = new DatabaseSync(file, { readOnly: true }); }
catch { db = new DatabaseSync(file); }

const users = db.prepare(
  `select id, username, email, phone, telegram_id as tg_id, telegram_username as tg_user,
          display_name, (avatar is not null) as avatar, created_at
   from users order by id`).all();
const sess = db.prepare('select count(*) c from sessions').get();

console.log('\nФайл БД:', file);
console.log('Пользователей:', users.length, '· активных сессий:', sess.c, '\n');
if (users.length) console.table(users);
else console.log('(пока никто не зарегистрирован — заведи аккаунт на сайте)');
console.log('');
