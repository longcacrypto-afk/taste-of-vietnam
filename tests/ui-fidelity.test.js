// The product routes must look like the repo's original screens (owner rule):
// original labels, palette and phone layout; only invented figures are replaced.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createInitialStore } from '../src/data/seed.js';

const runtime = fs.readFileSync('ui-design/src/product_runtime.js', 'utf8');
const forms = fs.readFileSync('ui-design/src/admin_forms.js', 'utf8');

test('original labels, badges and screen codes are not rewritten on product routes', () => {
  assert.doesNotMatch(runtime, /"Trang chủ"\)\.replace\(\/\^Explore/);
  assert.doesNotMatch(runtime, /AI Powered\/g, "Gợi ý bữa ăn"/);
  assert.doesNotMatch(runtime, /M\\d\{1,2\}\[-–\]S\\d\{2\}/, 'screen codes stay as designed');
});

test('original palette is kept (no inline colour overrides)', () => {
  assert.doesNotMatch(runtime, /el\.style\.color=to/);
  assert.doesNotMatch(runtime, /bg-\[#00B14F\]"\)\) el\.style/);
});

test('phone admin keeps the original hidden sidebar and Home gets no extra control', () => {
  assert.match(forms, /if \(!phone\) nav\.closest\("aside"\)\.style\.setProperty\("display","flex","important"\)/);
  assert.doesNotMatch(forms, /\["M3-S01","M1-S09","M1-S03"\]\.includes/);
  assert.match(forms, /activeScreenId === "M1-S09"/);
});

test('empty states inside a screen do not nest a second screen header', () => {
  assert.match(runtime, /function stateHtml\(id, s, nested = false, err = null\)/);
  assert.match(runtime, /content\.innerHTML=stateHtml\(id,"empty", true\)/);
  assert.doesNotMatch(runtime, /if\(id==="M1-S09" && TOV_AUTH\.role\(\)==="guest"\)/, 'guest Profile keeps original flow');
});

test('migration 011 backfills every original catalogue dish display field', () => {
  const sql = fs.readFileSync('src/db/migrations/011_catalog_display_backfill.sql', 'utf8');
  const st = createInitialStore();
  for (const d of st.dishes) {
    assert.ok(sql.includes(`WHERE id = '${d.id}'`), d.id);
    if (d.img_key) assert.ok(sql.includes(`COALESCE(img_key, '${d.img_key}')`), d.id + ' img');
  }
  assert.doesNotMatch(sql, /\b(allergen_flags|diet_flags|ingredients|recipe_steps|links|phone)\s*=/, 'no safety or partner fields');
});
