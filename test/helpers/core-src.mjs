// shared/core.js — большой IIFE для браузера: импортировать его в Node нельзя, а
// переписывать формулы в тест нельзя тем более (копия разойдётся с оригиналом в первую же
// правку и тест начнёт врать). Поэтому вырезаем исходный текст нужных функций по маркерам
// и исполняем как есть в песочнице, подставив только то, что в браузере даёт витрина.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

export const repoFile = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
export const CORE_SRC = repoFile('shared/core.js');

// исходный текст от начала from до начала to
export function slice(from, to) {
  const a = CORE_SRC.indexOf(from);
  if (a < 0) throw new Error('не нашёл в core.js начало: ' + from);
  const b = CORE_SRC.indexOf(to, a);
  if (b < 0) throw new Error('не нашёл в core.js конец: ' + to);
  return CORE_SRC.slice(a, b);
}

// песочница из кусков core.js и заглушек; expose — какие имена вернуть наружу
export function sandbox(parts, stubs, expose) {
  const box = Object.assign({ out: null }, stubs);
  vm.createContext(box);
  vm.runInContext(parts.join('\n') + '\nout = { ' + expose.join(', ') + ' };', box);
  return { api: box.out, box };
}

// Массив, собранный внутри песочницы, приходит с чужим Array.prototype, и строгое
// сравнение его отвергает. Переносим в обычный массив перед проверкой.
export const plain = (a) => Array.from(a);

export const esc = (s) =>
  String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
