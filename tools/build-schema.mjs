// Собирает supabase/apply_all.sql из всех миграций по порядку.
//
// Обычный путь раскатки это `supabase db push`, и он ничего отсюда не читает. Файл нужен для
// другого случая: когда CLI под рукой нет, а схему надо поднять с нуля через SQL-редактор в
// браузере. Раньше он собирался руками, отстал на сорок миграций и молча врал, что содержит
// всю схему. Теперь пересобирается командой, а `--check` в тестах не даст ему отстать снова.
//
//   npm run schema         пересобрать
//   npm run schema:check   проверить, что не отстал
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

const ROOT = new URL('../', import.meta.url);
const DIR = new URL('supabase/migrations/', ROOT);
const OUT = new URL('supabase/apply_all.sql', ROOT);

const files = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
if (!files.length) throw new Error('миграций не найдено');

const head = `-- KatoVape: вся схема одним файлом (${files[0].slice(0, 4)}..${files[files.length - 1].slice(0, 4)}).
--
-- Файл собран автоматически: npm run schema. Руками не правьте, правьте миграцию.
-- Обычный путь раскатки это \`supabase db push\`; этот файл на случай, когда CLI недоступен:
-- Supabase Dashboard -> SQL Editor -> New query -> вставить всё -> Run.
-- Повторный прогон безопасен: миграции идемпотентны.
`;

const body = files.map((f) => {
  const sep = '-- '.padEnd(4, '=') + ('=').repeat(16) + ' ' + f + ' ' + ('=').repeat(16);
  return '\n\n' + sep + '\n\n' + readFileSync(new URL(f, DIR), 'utf8').trimEnd() + '\n';
}).join('');

const built = head + body;
const check = process.argv.includes('--check');
let current = '';
try { current = readFileSync(OUT, 'utf8'); } catch (e) { /* файла ещё нет */ }

if (built === current) {
  console.log('apply_all.sql в порядке: ' + files.length + ' миграций');
} else if (check) {
  console.error('apply_all.sql отстал от миграций. Запустите: npm run schema');
  process.exit(1);
} else {
  writeFileSync(OUT, built);
  console.log('пересобран apply_all.sql: ' + files.length + ' миграций');
}
