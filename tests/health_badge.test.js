// P0: the UI shows "Gemini Active" only when /health says a GEMINI_API_KEY is configured
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createAppServer } from '../server.js';

async function health() {
  const server = createAppServer();
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/health`);
    return await res.json();
  } finally {
    server.close();
  }
}

test('/health reports gemini_active from GEMINI_API_KEY', async () => {
  const prev = process.env.GEMINI_API_KEY;
  try {
    delete process.env.GEMINI_API_KEY;
    assert.equal((await health()).gemini_active, false);
    process.env.GEMINI_API_KEY = 'test-key';
    assert.equal((await health()).gemini_active, true);
  } finally {
    if (prev === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = prev;
  }
});

test('UI source: AI badge defaults to "Chế độ dự phòng", no hard-coded "Gemini 2.0 Flash Active"', () => {
  const shell = fs.readFileSync(new URL('../ui-design/src/app_shell.html', import.meta.url), 'utf8');
  assert.ok(!shell.includes('Gemini 2.0 Flash Active'));
  assert.ok(shell.includes('data-ai-label>Chế độ dự phòng<'));
  assert.ok(shell.includes('h.gemini_active'));
});
