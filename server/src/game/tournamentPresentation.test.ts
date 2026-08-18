/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { presentCompletedTournamentTop3 } from './tournamentPresentation';

test('возвращает только сохранённых призёров, сортирует по месту и переносит гильдии', () => {
  const top3 = presentCompletedTournamentTop3([
    {
      userId: 30,
      username: 'Бронза',
      guildName: 'Волки',
      guildId: 7,
      snapshotStats: JSON.stringify({ version: 1, result: { place: 3, prize: 200 } }),
    },
    {
      userId: 40,
      username: 'Без места',
      guildName: 'Лисы',
      guildId: 8,
      snapshotStats: { version: 1, combatPower: 900 },
    },
    {
      userId: 10,
      username: 'Золото',
      guildName: 'Драконы',
      guildId: 5,
      snapshotStats: { version: 1, place: 1, prize: 500 },
    },
    {
      userId: 20,
      username: 'Серебро',
      guildName: null,
      guildId: null,
      snapshotStats: JSON.stringify({ version: 1, result: { place: 2, prize: 300 } }),
    },
  ]);

  assert.deepEqual(top3, [
    {
      version: 1,
      place: 1,
      prize: 500,
      username: 'Золото',
      guildName: 'Драконы',
      guildId: 5,
    },
    {
      version: 1,
      result: { place: 2, prize: 300 },
      place: 2,
      prize: 300,
      username: 'Серебро',
      guildName: null,
      guildId: null,
    },
    {
      version: 1,
      result: { place: 3, prize: 200 },
      place: 3,
      prize: 200,
      username: 'Бронза',
      guildName: 'Волки',
      guildId: 7,
    },
  ]);
});

test('возвращает не более одного участника на каждое призовое место', () => {
  const top3 = presentCompletedTournamentTop3([
    { username: 'Первый победитель', snapshotStats: { result: { place: 1, prize: 500 } } },
    { username: 'Дубликат победителя', snapshotStats: { result: { place: 1, prize: 500 } } },
    { username: 'Серебро', snapshotStats: { result: { place: 2, prize: 300 } } },
    { username: 'Дубликат серебра', snapshotStats: { result: { place: 2, prize: 300 } } },
  ]);

  assert.deepEqual(top3.map(entry => [entry.place, entry.username]), [
    [1, 'Первый победитель'],
    [2, 'Серебро'],
  ]);
});

test('игнорирует некорректные JSON и места вне диапазона 1..3', () => {
  const top3 = presentCompletedTournamentTop3([
    { username: 'Сломан', snapshotStats: '{' },
    { username: 'Ноль', snapshotStats: { place: 0 } },
    { username: 'Четвёртый', snapshotStats: { result: { place: 4, prize: 10 } } },
    { username: 'Строковое место', snapshotStats: { result: { place: '2', prize: 20 } } },
  ]);

  assert.deepEqual(top3, []);
});
