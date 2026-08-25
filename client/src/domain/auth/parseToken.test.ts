/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { parseUserFromToken } from './parseToken.ts';

test('parses a player JWT payload into the client user model', () => {
  const payload = { userId: 42, role: 'player', username: 'Knight', gender: 'female', isGuest: true };
  const token = `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;

  assert.deepEqual(parseUserFromToken(token), {
    id: 42,
    username: 'Knight',
    level: 1,
    role: 'player',
    gender: 'female',
    isGuest: true,
  });
});

test('rejects malformed, incomplete, and expired tokens', () => {
  assert.equal(parseUserFromToken('not-a-jwt'), null);
  assert.equal(parseUserFromToken('a.%%%.c'), null);

  const expired = { adminId: 7, role: 'admin', exp: Math.floor(Date.now() / 1000) - 1 };
  const token = `a.${Buffer.from(JSON.stringify(expired)).toString('base64url')}.c`;
  assert.equal(parseUserFromToken(token), null);

  const missingIdentity = { role: 'player' };
  const incomplete = `a.${Buffer.from(JSON.stringify(missingIdentity)).toString('base64url')}.c`;
  assert.equal(parseUserFromToken(incomplete), null);
});

test('supports URL-safe payloads without mutating token values', () => {
  const payload = { adminId: 8, role: 'admin', username: 'A', exp: Math.floor(Date.now() / 1000) + 60 };
  const token = `a.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.c`;

  assert.equal(parseUserFromToken(token)?.id, 8);
  assert.equal(token.split('.').length, 3);
});
