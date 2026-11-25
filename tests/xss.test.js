// =============================================================================
// P0: stored XSS — values from the API are escaped before innerHTML; the server
// strips HTML from community recipes
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createInitialStore } from '../src/data/seed.js';
import { handleApiRequest, cleanText } from '../src/api/router.js';
import { guest } from './helpers/auth.js';
import { loadUi } from './helpers/ui.js';

const PAYLOAD = '<img src=x onerror="window.__xss=1">Bún<script>window.__xss=2</script>';

test('Server strips HTML from community recipe fields and validates title', async () => {
  const store = createInitialStore();
  const g = await guest(store);
  const res = await handleApiRequest(store, 'POST', '/api/v1/community/recipes', new URLSearchParams(), {
    title: PAYLOAD, author: '<b>x</b>Mẹ', ingredients: ['<svg onload=alert(1)>Hành', 42, { a: 1 }], zero_waste_tag: '<i>♻</i>', calories: 'lots'
  }, g.headers);
  assert.equal(res.status, 201);
  const stored = JSON.stringify(res.data);
  assert.ok(!/[<>]/.test(stored), `no angle brackets stored: ${stored}`);
  assert.equal(res.data.title, 'Búnwindow.__xss=2');
  assert.equal(res.data.calories, 450);

  const empty = await handleApiRequest(store, 'POST', '/api/v1/community/recipes', new URLSearchParams(), { title: '<script></script>' }, g.headers);
  assert.equal(empty.status, 400);

  const id = res.data.id;
  const patch = await handleApiRequest(store, 'PATCH', `/api/v1/community/recipes/${id}`, new URLSearchParams(), { title: '<img src=x onerror=alert(1)>Mới' }, g.headers);
  assert.equal(patch.data.title, 'Mới');
});

test('cleanText removes tags, brackets and control characters', () => {
  assert.equal(cleanText('<img src=x onerror=alert(1)>Phở'), 'Phở');
  assert.equal(cleanText('a < b > c'), 'a b c');
  assert.equal(cleanText('Phở < 50k'), 'Phở 50k');
  assert.equal(cleanText('x\u0000y'), 'x y');
  assert.equal(cleanText({}), '');
  assert.equal(cleanText('a'.repeat(500), 10).length, 10);
});

test('UI escape helpers: escHtml / escJs / safeUrl', () => {
  const w = loadUi();
  assert.equal(w.escHtml('<img src=x onerror="a">&\''), '&lt;img src=x onerror=&quot;a&quot;&gt;&amp;&#39;');
  assert.equal(w.escHtml(undefined), '');
  assert.equal(w.escHtml(0), '0');
  // escJs output, once the HTML parser decodes the attribute, is a safe JS string body
  const decoded = w.escJs(`'); alert(1); ('</script>`).replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  assert.equal(eval(`'${decoded}'`), `'); alert(1); ('</script>`);
  assert.equal(w.safeUrl('javascript:alert(1)'), '#');
  assert.equal(w.safeUrl(' JaVaScRiPt:alert(1)'), '#');
  assert.equal(w.safeUrl('data:text/html,x'), '#');
  assert.equal(w.safeUrl('//evil.example'), '#');
  assert.equal(w.safeUrl('https://food.grab.com/vn?a=1&b=2'), 'https://food.grab.com/vn?a=1&amp;b=2');
  assert.equal(w.safeUrl('tel:0912345678'), 'tel:0912345678');
});

test('UI /app M3-S01 renders a malicious dish name as text, not markup', () => {
  const evil = { dish_id: "D1');alert(1);('", name: PAYLOAD, price_vnd: 1000, reason: '<b onmouseover=alert(1)>x</b>' };
  const w = loadUi({ liveToday: { items: [evil, evil, evil] }, liveChatReply: '<img src=x onerror=alert(1)>', liveChatQuery: '"><script>alert(1)</script>' });
  const home = w.SCREENS_M3_M4_M5_M8['M3-S01'].render();
  assert.ok(!home.includes('<img src=x'), 'no injected img tag');
  assert.ok(!home.includes('<script>window'), 'no injected script tag');
  assert.ok(!home.includes('<b onmouseover'), 'no injected b tag');
  assert.ok(home.includes('&lt;img src=x onerror=&quot;window.__xss=1&quot;&gt;Bún'));
  assert.ok(!home.includes("D1');alert(1)"), 'dish id cannot break out of the onclick string');
  const chat = w.SCREENS_M3_M4_M5_M8['M3-S04'].render();
  assert.ok(!chat.includes('<img src=x'));
  assert.ok(!chat.includes('"><script>'));
});

test('app_shell.html: the known stored-XSS sinks now use the escape helpers', () => {
  const shell = fs.readFileSync(new URL('../ui-design/src/app_shell.html', import.meta.url), 'utf8');
  for (const sink of ['${escHtml(r.title)}', '${escHtml(r.author)}', '${escHtml(ing)}', '${escHtml(item.name)}', '${escHtml(text)}', '${escHtml(answer)}', '${escHtml(p.name)}', '${escHtml(dish.name)}']) {
    assert.ok(shell.includes(sink), `missing ${sink}`);
  }
  for (const raw of ['${r.title}', '${r.author}</div>', "tipLiveRecipe('${r.id}', '${r.author}')", '${text}\n', '<p class="whitespace-pre-line">${answer}</p>']) {
    assert.ok(!shell.includes(raw), `still raw: ${raw}`);
  }
});
