import test from 'node:test';
import assert from 'node:assert/strict';
import { slice, sandbox, plain } from './helpers/core-src.mjs';

function box(reviewables, modal) {
  const { api, box: b } = sandbox(
    [slice('  function canReviewNow(', '  async function loadReviews()')],
    { reviewables, modal: modal || {} },
    ['canReviewNow', 'reviewableFlavors', 'reviewFlavor']
  );
  return { api, b };
}

const BOUGHT = [
  { product_id: 'hqd', flavor: 'Mint' },
  { product_id: 'hqd', flavor: 'Black Dragon' },
  { product_id: 'elf-liq', flavor: '' }
];

test('форма открыта на купленный вкус, даже когда в карточке открыт другой', () => {
  const { api } = box(BOUGHT, {});
  assert.equal(api.reviewFlavor('hqd', 'Watermelon'), 'Mint');
  assert.equal(api.reviewFlavor('hqd', ''), 'Mint');
});

test('открытый вкус выигрывает, если он куплен', () => {
  const { api } = box(BOUGHT, {});
  assert.equal(api.reviewFlavor('hqd', 'Black Dragon'), 'Black Dragon');
});

test('выбор в самой форме важнее того, что открыто в карточке', () => {
  const { api } = box(BOUGHT, { revFl: 'Black Dragon' });
  assert.equal(api.reviewFlavor('hqd', 'Mint'), 'Black Dragon');
});

test('выбор в форме игнорируется, если такой вкус не покупали', () => {
  const { api } = box(BOUGHT, { revFl: 'Watermelon' });
  assert.equal(api.reviewFlavor('hqd', 'Mint'), 'Mint');
});

test('товар без вкусов оценивается пустым ключом', () => {
  const { api } = box(BOUGHT, {});
  assert.equal(api.reviewFlavor('elf-liq', ''), '');
  assert.deepEqual(plain(api.reviewableFlavors('elf-liq')), ['']);
});

test('некупленная модель права на отзыв не даёт', () => {
  const { api } = box(BOUGHT, {});
  assert.equal(api.reviewFlavor('puffy', 'Bubble'), null);
  assert.deepEqual(plain(api.reviewableFlavors('puffy')), []);
});

test('гость без загруженного списка отзыв не оставит', () => {
  const { api } = box(null, {});
  assert.equal(api.reviewFlavor('hqd', 'Mint'), null);
  assert.equal(api.canReviewNow('hqd', 'Mint'), false);
});

test('повторная покупка того же вкуса не даёт дублей в списке', () => {
  const { api } = box([
    { product_id: 'hqd', flavor: 'Mint' },
    { product_id: 'hqd', flavor: 'Mint' }
  ], {});
  assert.deepEqual(plain(api.reviewableFlavors('hqd')), ['Mint']);
});

test('точечная проверка пары товар+вкус осталась строгой', () => {
  const { api } = box(BOUGHT, {});
  assert.equal(api.canReviewNow('hqd', 'Mint'), true);
  assert.equal(api.canReviewNow('hqd', 'Watermelon'), false);
});
