// Гамма вкуса: цвет полоски и подложки в карточке товара.
//
// Витрина умеет подбирать цвет по названию (арбуз красный, мята зелёная), но словарь знает
// не всё, а незнакомое имя получало оттенок из хеша: стабильный, зато случайный, из-за чего
// половина новых вкусов выходила фиолетовой. Поэтому цвет можно назначить руками в панели.
//
// В базе лежит ОДИН цвет как #rrggbb. Второй конец градиента считается из него: пара,
// подобранная человеком на глаз, каждый раз выходила бы разной по характеру, а так вся
// витрина остаётся одинаковой на вид, кто бы ни заводил вкус. Пресеты ниже это просто
// удобные образцы, они хранятся тем же способом и ничем не отличаются от набранного руками.
//
// Модуль общий у панели с витриной, поэтому лежит отдельным файлом.
window.KV_TINT = (function () {
  // Образцы под привычные вкусы. id нигде не хранится, он нужен панели для подписи.
  const PRESETS = [
    { id: 'mint',      c: '#5ff3d0' },
    { id: 'ice',       c: '#8fd8ff' },
    { id: 'tropic',    c: '#67dcf5' },
    { id: 'apple',     c: '#8fe264' },
    { id: 'citrus',    c: '#ffd95e' },
    { id: 'peach',     c: '#ffa15c' },
    { id: 'berry',     c: '#ff5f7d' },
    { id: 'candy',     c: '#ff8ad2' },
    { id: 'grape',     c: '#b46bff' },
    { id: 'blueberry', c: '#7f8cff' },
    { id: 'coffee',    c: '#c68d5c' },
    { id: 'tobacco',   c: '#b9a48a' },
    { id: 'graphite',  c: '#b3c0cc' }
  ];

  // Приводим к #rrggbb. Принимаем и без решётки, и в три знака (#f0a), и с пробелами:
  // цвет часто копируют из чужого макета, и придираться к форме незачем.
  function norm(v) {
    let s = String(v == null ? '' : v).trim().toLowerCase().replace(/^#/, '');
    if (/^[0-9a-f]{3}$/.test(s)) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    return /^[0-9a-f]{6}$/.test(s) ? '#' + s : null;
  }

  function toHsl(hex) {
    const n = parseInt(hex.slice(1), 16);
    const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    const l = (max + min) / 2;
    let h = 0, s = 0;
    if (d) {
      s = d / (1 - Math.abs(2 * l - 1));
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    return { h, s: s * 100, l: l * 100 };
  }

  function toHex(h, s, l) {
    s /= 100; l /= 100;
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
    const t = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
            : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    const p = v => Math.round((v + m) * 255).toString(16).padStart(2, '0');
    return '#' + p(t[0]) + p(t[1]) + p(t[2]);
  }

  // Второй конец градиента. Числа сняты с прежних пар, подобранных на глаз: тон тот же,
  // светлота ниже примерно на четверть, насыщенность чуть мягче.
  function deep(hex) {
    const c = toHsl(hex);
    // У почти чёрного темнеть некуда, и градиент выродился бы в пятно: уходим в свет.
    const l = c.l < 30 ? Math.min(c.l + 24, 92) : Math.max(c.l - 22, 18);
    // Насыщенность только гасим и никогда не выдумываем: у белого и серого её нет вовсе,
    // а тон у них формально красный, поэтому любой минимум красил их в розовое.
    return toHex(c.h, c.s * 0.74, l);
  }

  // Пара цветов для градиента. Возвращает null, если цвет не разобрали: тогда витрина
  // подбирает его по названию вкуса, как делала всегда.
  function pair(v) {
    const hex = norm(v);
    return hex ? [hex, deep(hex)] : null;
  }

  function grad(v) {
    const p = pair(v);
    return p ? 'linear-gradient(165deg,' + p[0] + ',' + p[1] + ')' : '';
  }

  // HSV нужен палитре в панели: квадрат «насыщенность на светлоту» и полоса тона это
  // именно он, а не HSL. Живёт здесь, чтобы вся возня с цветом лежала в одном месте.
  function toHsv(hex) {
    const n = parseInt(hex.slice(1), 16);
    const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0;
    if (d) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    return { h, s: max ? (d / max) * 100 : 0, v: max * 100 };
  }
  function fromHsv(h, s, v) {
    s /= 100; v /= 100;
    const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
    const t = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
            : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    const p = q => Math.round((q + m) * 255).toString(16).padStart(2, '0');
    return '#' + p(t[0]) + p(t[1]) + p(t[2]);
  }

  return { PRESETS, norm, pair, grad, deep, toHsl, toHex, toHsv, fromHsv };
})();
