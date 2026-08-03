// apply_all.sql уже один раз отстал от миграций на сорок штук и при этом уверял, что
// содержит всю схему. Проверку держим в тестах, чтобы это не повторилось молча.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const TOOL = fileURLToPath(new URL('../tools/build-schema.mjs', import.meta.url));

test('apply_all.sql собран из текущих миграций', () => {
  try {
    execFileSync(process.execPath, [TOOL, '--check'], { encoding: 'utf8', stdio: 'pipe' });
  } catch (e) {
    assert.fail((e.stderr || e.message).trim());
  }
});
