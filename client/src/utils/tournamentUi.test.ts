/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { getTournamentCallToAction } from './tournamentUi.ts';

test('does not show registration before the initial load completes', () => {
    assert.equal(getTournamentCallToAction({ loaded: false, tournament: null, nextSeconds: 0 }), 'loading');
});

test('uses the loaded server state for the tournament action', () => {
    assert.equal(getTournamentCallToAction({ loaded: true, tournament: null, nextSeconds: 34 * 60 }), 'countdown');
    assert.equal(getTournamentCallToAction({ loaded: true, tournament: { status: 'registration' }, nextSeconds: 0 }), 'joinable');
    assert.equal(getTournamentCallToAction({ loaded: true, tournament: null, nextSeconds: 0 }), 'joinable');
});
