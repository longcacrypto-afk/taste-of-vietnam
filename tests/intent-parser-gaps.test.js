// Local Vietnamese NLU (no Gemini): children counts, "vợ chồng", decimal "triệu".
import test from 'node:test';
import assert from 'node:assert/strict';
import { extractVietnameseIntent as parse } from '../src/services/intentParser.js';

test('NLU: "có 2 bé" = 2 children (has_kids, no spice)', () => {
  const p = parse('Tối nay cả nhà 5 người, có 2 bé, ngân sách 500k');
  assert.equal(p.kids_count, 2);
  assert.equal(p.has_kids, true);
  assert.equal(p.spice_max, 0);
  assert.equal(p.party_size, 5);
  assert.equal(p.adults, 3);
  const q = parse('có 2 bé đi ăn trưa');
  assert.equal(q.kids_count, 2);
  assert.ok(q.party_size >= 3, 'children come with at least one adult');
  assert.equal(parse('4 người trong đó 2 trẻ nhỏ').kids_count, 2);
  assert.equal(parse('2 người lớn 1 bé 300k').party_size, 3);
  assert.equal(parse('vợ chồng với 2 con 300k').party_size, 4);
});

test('NLU: "hai vợ chồng" = 2 adults / 2 people', () => {
  for (const q of ['Hai vợ chồng ăn trưa 200k không cay', 'hai vo chong an toi', '2 vợ chồng ăn gì']) {
    const p = parse(q);
    assert.equal(p.party_size, 2, q);
    assert.equal(p.adults, 2, q);
    assert.equal(p.kids_count, 0, q);
  }
  const f = parse('Hai vợ chồng có 2 bé ăn tối 400k');
  assert.deepEqual([f.party_size, f.adults, f.kids_count, f.has_kids], [4, 2, 2, true]);
});

test('NLU: "1.5 triệu" / "1,5 triệu" = 1.500.000đ (not 5 triệu)', () => {
  assert.equal(parse('Trưa nay 10 người ngân sách 1.5 triệu').total_budget_vnd, 1500000);
  assert.equal(parse('Trưa nay 10 người ngân sách 1,5 triệu').total_budget_vnd, 1500000);
  assert.equal(parse('1tr5 cho 6 người').total_budget_vnd, 1500000);
  assert.equal(parse('nhóm bạn 1 triệu rưỡi').total_budget_vnd, 1500000);
  assert.equal(parse('1.500.000đ cho nhóm').total_budget_vnd, 1500000);
  assert.equal(parse('Nhóm 8 người 1 triệu').total_budget_vnd, 1000000);
  assert.equal(parse('1 triệu 2 người').total_budget_vnd, 1000000);
  assert.equal(parse('2 người 150k').total_budget_vnd, 150000);
  assert.equal(parse('năm 2026 ăn gì').total_budget_vnd, 60000, 'a year is not a budget');
  assert.equal(parse('2 con cua').kids_count, 0);
});
