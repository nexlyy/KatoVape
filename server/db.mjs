// SQLite на встроенном node:sqlite (Node 22.5+). Файл katovape.db рядом со скриптом.
// Пароли не храним в открытом виде: только scrypt-хеш с солью.
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
export const db = new DatabaseSync(join(here, 'katovape.db'));

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
`);
