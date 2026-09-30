import test from 'node:test';
import assert from 'node:assert/strict';

process.env.TOKEN_ENCRYPTION_KEY = 'x'.repeat(40);
const { encrypt, decrypt } = await import('../api/_lib/crypto.js');

test('encrypt/decrypt round trip', () => {
  const value = 'refresh-token-123';
  const sealed = encrypt(value);
  assert.notEqual(sealed, value);
  assert.equal(decrypt(sealed), value);
  assert.notEqual(encrypt(value), sealed, 'IV must be random');
});

test('tampered ciphertext is rejected', () => {
  const [iv, tag, data] = encrypt('secret').split('.');
  const flipped = Buffer.from(data, 'base64url');
  flipped[0] ^= 1;
  assert.throws(() => decrypt([iv, tag, flipped.toString('base64url')].join('.')));
});

test('empty values stay null', () => {
  assert.equal(encrypt(''), null);
  assert.equal(decrypt(null), null);
});
