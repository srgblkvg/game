import assert from 'node:assert/strict';
import test from 'node:test';
import { sortGuildMembers, type GuildMember } from './guildMembers.ts';

const member = (userId: number, rank: string, level?: number): GuildMember => ({ userId, rank, level });

test('sorts members by rank, then descending level, preserving ties', () => {
    const members = [
        member(1, 'member', 5),
        member(2, 'leader', 1),
        member(3, 'officer', 10),
        member(4, 'officer', 10),
        member(5, 'unknown', 20),
        member(6, 'member'),
    ];

    const result = sortGuildMembers(members);

    assert.deepEqual(result.map((m: GuildMember) => m.userId), [2, 3, 4, 5, 1, 6]);
    assert.deepEqual(members.map(m => m.userId), [1, 2, 3, 4, 5, 6]);
});

test('returns an empty array for no members', () => {
    assert.deepEqual(sortGuildMembers([]), []);
});

