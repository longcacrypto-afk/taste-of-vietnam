// Ephemeral local keys only. No real Google account, credentials or HTTP requests.
import crypto from 'node:crypto';
export const CLIENT_ID = 'local-client.apps.googleusercontent.com';
const pair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
export const jwk = { ...pair.publicKey.export({ format: 'jwk' }), kid: 'local-test-key', alg: 'RS256', use: 'sig' };
export function googleToken(changes = {}, header = {}, key = pair.privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: 'https://accounts.google.com', aud: CLIENT_ID, sub: 'google-sub-1', iat: now, exp: now + 3600, email: 'Owner@Example.com', email_verified: true, ...changes };
  const enc = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${enc({ alg: 'RS256', kid: jwk.kid, typ: 'JWT', ...header })}.${enc(payload)}`;
  return `${unsigned}.${crypto.sign('RSA-SHA256', Buffer.from(unsigned), key).toString('base64url')}`;
}
export function mockGoogleFetch(t, { status = 200, keys = [jwk], fail = false } = {}) {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls++;
    if (url !== 'https://www.googleapis.com/oauth2/v3/certs') throw new Error('Unexpected network');
    if (!options.signal || options.redirect !== 'error') throw new Error('Missing bounded network configuration');
    if (fail) throw new Error('provider offline');
    return new Response(JSON.stringify({ keys }), { status, headers: { 'cache-control': 'public, max-age=3600' } });
  });
  return () => calls;
}
