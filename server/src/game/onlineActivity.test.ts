/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { activityDeltaSeconds, normalizeGamePath } from './onlineActivity';

test('активное время засчитывается только видимой вкладке', () => {
    assert.equal(activityDeltaSeconds(1_000, 1_030, true), 30);
    assert.equal(activityDeltaSeconds(1_000, 1_030, false), 0);
});

test('разрыв между heartbeat ограничен минутой', () => {
    assert.equal(activityDeltaSeconds(1_000, 1_600, true), 60);
    assert.equal(activityDeltaSeconds(1_030, 1_000, true), 0);
});

test('динамические игровые адреса объединяются для аналитики', () => {
    assert.equal(normalizeGamePath('/profile/123?tab=stats'), '/profile/:id');
    assert.equal(normalizeGamePath('/guild/42'), '/guild/:id');
    assert.equal(normalizeGamePath('/forum/987#post-1'), '/forum/:id');
    assert.equal(normalizeGamePath('/auction?lot=100'), '/auction');
});

test('неизвестный и слишком длинный путь безопасно нормализуется', () => {
    assert.equal(normalizeGamePath(''), '/');
    assert.equal(normalizeGamePath('auction'), '/auction');
    assert.equal(normalizeGamePath('/' + 'a'.repeat(300)).length, 120);
});
