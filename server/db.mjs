// SQLite на встроенном node:sqlite (нужен Node 22+). Файл katovape.db рядом со скриптом.
// Пароли не храним в открытом виде: только scrypt-хеш с солью.
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
export const db = new DatabaseSync(process.env.KV_DB || join(here, 'katovape.db'));
db.exec('pragma journal_mode = WAL; pragma foreign_keys = on;');

db.exec(`
create table if not exists users (
  id                integer primary key autoincrement,
  username          text unique not null,
  email             text unique,
  phone             text unique,
  pass_hash         text,
  telegram_id       integer unique,
  telegram_username text,
  display_name      text,
  avatar            text,
  created_at        text not null default (datetime('now'))
);
create table if not exists sessions (
  token      text primary key,
  user_id    integer not null references users(id) on delete cascade,
  created_at text not null default (datetime('now'))
);

-- кто нажал /start у бота: только этим можно слать уведомления и рассылки
create table if not exists bot_users (
  telegram_id integer primary key,
  username    text,
  first_name  text,
  lang        text,
  opted_in    integer not null default 1,
  first_seen  text not null default (datetime('now'))
);

-- ассортимент, зеркало Google Sheets (источник для брони и витрины)
create table if not exists products (
  id         text not null,
  city       text not null,
  category   text,
  name       text,
  brand      text,
  flavor     text not null default '',
  price      integer,
  qty        integer not null default 0,
  nic        text,
  updated_at text not null default (datetime('now')),
  primary key (id, city, flavor)
);

-- бронь: оповестить, когда позиция появится в наличии
create table if not exists reservations (
  id          integer primary key autoincrement,
  user_id     integer references users(id) on delete set null,
  telegram_id integer,
  city        text not null,
  product_id  text not null,
  product_name text,
  flavor      text not null default '',
  status      text not null default 'waiting',   -- waiting | notified | cancelled
  created_at  text not null default (datetime('now')),
  notified_at text
);

-- заказы (сохраняем состав и сумму для админки)
create table if not exists orders (
  id          integer primary key autoincrement,
  user_id     integer references users(id) on delete set null,
  telegram_id integer,
  city        text not null,
  items       text not null,        -- json массив строк заказа
  sum         integer not null default 0,
  delivery    text,                 -- pickup | inpost | courier
  address     text,
  status      text not null default 'new',   -- new | paid | done | cancelled
  created_at  text not null default (datetime('now'))
);

-- рассылки (лог)
create table if not exists broadcasts (
  id         integer primary key autoincrement,
  author_id  integer,
  text       text not null,
  audience   text not null default 'all',
  sent       integer not null default 0,
  failed     integer not null default 0,
  created_at text not null default (datetime('now'))
);

-- простой счётчик спроса (просмотры товара, добавления, брони)
create table if not exists demand (
  product_id text not null,
  event      text not null,     -- view | reserve | order
  n          integer not null default 0,
  primary key (product_id, event)
);
`);
