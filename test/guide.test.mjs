import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { repoFile } from './helpers/core-src.mjs';

const LANGS = ['ru', 'uk', 'pl'];
const box = { window: {}, localStorage: null, navigator: {}, document: null };
vm.createContext(box);
for (const l of LANGS) vm.runInContext(repoFile('demos/admin/guide-' + l + '.js'), box);
const BOOK = Object.fromEntries(LANGS.map((l) => [l, box.window['KV_GUIDE_' + l.toUpperCase()]]));

const KINDS = ['manager', 'owner'];
const BLOCKS = new Set(['p', 'h3', 'ul', 'steps', 'note', 'table']);

test('все три языка описаны', () => {
  for (const l of LANGS) assert.ok(BOOK[l], 'нет текстов для ' + l);
});

for (const kind of KINDS) {
  test(kind + ': набор разделов одинаков во всех языках', () => {
    const base = BOOK.ru[kind].sections.map((s) => s.id);
    for (const l of ['uk', 'pl']) {
      assert.deepEqual(BOOK[l][kind].sections.map((s) => s.id), base, l + ': разделы разошлись');
    }
  });

  test(kind + ': в каждом разделе столько же блоков', () => {
    for (const [i, s] of BOOK.ru[kind].sections.entries()) {
      for (const l of ['uk', 'pl']) {
        assert.equal(BOOK[l][kind].sections[i].blocks.length, s.blocks.length,
          l + '/' + s.id + ': другое число блоков');
      }
    }
  });

  test(kind + ': блоки одного вида на одних и тех же местах', () => {
    for (const [i, s] of BOOK.ru[kind].sections.entries()) {
      for (const [j, b] of s.blocks.entries()) {
        assert.ok(BLOCKS.has(b[0]), s.id + ': неизвестный вид блока ' + b[0]);
        for (const l of ['uk', 'pl']) {
          assert.equal(BOOK[l][kind].sections[i].blocks[j][0], b[0],
            l + '/' + s.id + ': вид блока не совпал');
        }
      }
    }
  });

  test(kind + ': у таблиц совпадает число столбцов и строк', () => {
    for (const [i, s] of BOOK.ru[kind].sections.entries()) {
      for (const [j, b] of s.blocks.entries()) {
        if (b[0] !== 'table') continue;
        for (const l of ['uk', 'pl']) {
          const t = BOOK[l][kind].sections[i].blocks[j];
          assert.equal(t[1].length, b[1].length, l + '/' + s.id + ': другое число столбцов');
          assert.equal(t[2].length, b[2].length, l + '/' + s.id + ': другое число строк');
          for (const [k, row] of b[2].entries()) {
            assert.equal(t[2][k].length, row.length, l + '/' + s.id + ': строка другой длины');
          }
        }
      }
    }
  });

  test(kind + ': перевод не остался русским', () => {
    const ru = JSON.stringify(BOOK.ru[kind]);
    for (const l of ['uk', 'pl']) {
      assert.notEqual(JSON.stringify(BOOK[l][kind]), ru, l + ': текст совпадает с русским');
    }
    assert.ok(!/[А-Яа-яЁёІіЇїЄє]/.test(JSON.stringify(BOOK.pl[kind])), 'в польском тексте кириллица');
  });

  test(kind + ': нет технических подробностей', () => {
    const words = ['npm ', 'supabase', 'docker', '.sql', '.md', 'runbook', 'миграц', 'репозитор', 'консол'];
    for (const l of LANGS) {
      const text = JSON.stringify(BOOK[l][kind]).toLowerCase();
      const hit = words.filter((w) => text.includes(w));
      assert.deepEqual(hit, [], l + '/' + kind + ': осталось техническое слово');
    }
  });
}

test('страницы подключают все языки и знают, какое руководство рисуют', () => {
  for (const [file, kind] of [['demos/admin/guide.html', 'manager'], ['demos/admin/guide-owner.html', 'owner']]) {
    const html = repoFile(file);
    for (const l of LANGS) assert.match(html, new RegExp('guide-' + l + '\\.js'), file + ': не подключён ' + l);
    assert.match(html, new RegExp("KV_GUIDE_KIND = '" + kind + "'"), file + ': не задан вид руководства');
  }
});
