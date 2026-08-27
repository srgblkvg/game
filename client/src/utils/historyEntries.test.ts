import assert from 'node:assert/strict';
import test from 'node:test';
import { buildHistoryEntries } from './historyEntries.ts';

test('builds tagged entries and sorts mixed timestamps descending', () => {
    const entries = buildHistoryEntries({
        battles: [{ id: 1, createdAt: '2026-08-27T10:00:00Z' }],
        pveBattles: [{ id: 2, createdAt: '2026-08-27T12:00:00Z' }],
        jobHistory: [{ id: 3, finishedAt: 1_756_300_000 }],
        tournamentHistory: [{ id: 4, completedAt: '2026-08-27T11:00:00Z' }],
        questHistory: [{ id: 5, createdAt: '2026-08-27T09:00:00Z' }],
        privateMessages: [{ id: 6, createdAt: '2026-08-27T08:00:00Z' }],
        massacreBattles: [{ id: 7, gathering_end: '2026-08-27T13:00:00Z' }],
    });

    assert.deepEqual(entries.map(entry => entry.id), ['mb-7', 'p-2', 't-4', 'b-1', 'q-5', 'm-6', 'j-3']);
    assert.deepEqual(entries.map(entry => entry.type), ['massacre', 'pve', 'tournament', 'battle', 'quest', 'message', 'job']);
    assert.strictEqual(entries[0]!.data.id, 7);
});

test('uses massacre created_at when gathering_end is absent and handles empty input', () => {
    const entries = buildHistoryEntries({
        battles: [], pveBattles: [], jobHistory: [], tournamentHistory: [],
        questHistory: [], privateMessages: [],
        massacreBattles: [{ id: 8, created_at: '2026-08-27T14:00:00Z' }],
    });

    assert.equal(entries.length, 1);
    assert.equal(entries[0]!.id, 'mb-8');
    assert.equal(entries[0]!.ts, new Date('2026-08-27T14:00:00Z').getTime());
});
