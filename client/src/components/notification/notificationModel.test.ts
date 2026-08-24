/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { getNotificationPath, parseNotificationDetail } from './notificationModel.ts';

test('parses valid notification event detail without changing payload values', () => {
  const data = { path: '/battle/42', result: 'win' };
  const detail = [{
    id: 7,
    type: 'battle_result',
    message: 'Победа!',
    data,
    createdAt: 1_725_000_000,
  }];

  const notifications = parseNotificationDetail(detail);

  assert.deepEqual(notifications, detail);
  assert.equal(notifications[0]?.data, data);
  assert.equal(getNotificationPath(notifications[0]?.data), '/battle/42');
});

test('rejects malformed event detail and keeps valid notifications from a mixed array', () => {
  const valid = {
    id: 8,
    type: 'system',
    message: 'Системное уведомление',
    data: '{"path":"/profile"}',
    createdAt: 1_725_000_001,
  } as const;

  assert.deepEqual(parseNotificationDetail(null), []);
  assert.deepEqual(parseNotificationDetail({ notifications: [valid] }), []);
  assert.deepEqual(parseNotificationDetail([
    valid,
    null,
    { ...valid, id: Number.NaN },
    { ...valid, type: 'unknown' },
    { ...valid, message: 123 },
    { ...valid, createdAt: '1725000001' },
  ]), [valid]);
});

test('reads compatible object and JSON-string navigation paths and ignores malformed data', () => {
  assert.equal(getNotificationPath({ path: '/guild' }), '/guild');
  assert.equal(getNotificationPath('{"path":"/massacre?eventId=5"}'), '/massacre?eventId=5');
  assert.equal(getNotificationPath('{bad json'), null);
  assert.equal(getNotificationPath({ path: 42 }), null);
  assert.equal(getNotificationPath(null), null);
});
