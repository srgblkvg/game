/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { readJsonResponse } from './http.ts';

test('понятно сообщает об HTML вместо JSON', async () => {
  const response = new Response('<!DOCTYPE html><html></html>', {
    status: 502,
    headers: { 'content-type': 'text/html' },
  });
  await assert.rejects(() => readJsonResponse(response), /Сервер временно перезапускается/);
});

test('возвращает JSON и сохраняет серверную ошибку', async () => {
  const response = new Response(JSON.stringify({ error: 'Кулдаун' }), {
    status: 400,
    headers: { 'content-type': 'application/json' },
  });
  await assert.rejects(() => readJsonResponse(response), /Кулдаун/);
});
