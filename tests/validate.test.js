import test from 'node:test';
import assert from 'node:assert/strict';
import { httpUrl, optionalHttpUrl, sniffImageType } from '../api/_lib/validate.js';

test('httpUrl only accepts web URLs', () => {
  assert.ok(httpUrl.safeParse('https://example.com/a.png').success);
  assert.ok(httpUrl.safeParse('http://example.com').success);
  assert.ok(!httpUrl.safeParse('javascript:alert(1)').success);
  assert.ok(!httpUrl.safeParse('data:text/html,<script>1</script>').success);
  assert.ok(optionalHttpUrl.safeParse('').success);
  assert.ok(optionalHttpUrl.safeParse(null).success);
  assert.ok(!optionalHttpUrl.safeParse('javascript:alert(1)').success);
});

test('sniffImageType identifies images by content', () => {
  assert.equal(sniffImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0])), 'image/jpeg');
  assert.equal(sniffImageType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])), 'image/png');
  assert.equal(sniffImageType(Buffer.from('GIF89a....')), 'image/gif');
  assert.equal(sniffImageType(Buffer.from('RIFF\0\0\0\0WEBPVP8 ')), 'image/webp');
  assert.equal(sniffImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')), null);
  assert.equal(sniffImageType(Buffer.alloc(0)), null);
});
