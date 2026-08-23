/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const auctionSource = readFileSync(resolve(__dirname, '../routes/auction.ts'), 'utf8');
const schemaSource = readFileSync(resolve(__dirname, '../db/schema.sql'), 'utf8');

test('auction route не владеет users DDL', () => {
  assert.doesNotMatch(auctionSource, /ALTER TABLE users/i);
});

test('canonical users schema объявляет auction counters и overflow money', () => {
  assert.match(schemaSource, /\bauction_sales\s+INTEGER\s+DEFAULT\s+0\b/i);
  assert.match(schemaSource, /\boverflowmoney\s+INTEGER\s+DEFAULT\s+0\b/i);
});

test('auction history lifecycle закреплён в canonical schema, а не route import', () => {
  assert.doesNotMatch(auctionSource, /CREATE TABLE IF NOT EXISTS auction_history/i);
  assert.match(schemaSource, /CREATE TABLE IF NOT EXISTS auction_history[\s\S]*sellerId INTEGER NOT NULL[\s\S]*createdAt TEXT NOT NULL/i);
  assert.match(auctionSource, /auction_sales = 0/);
});

// No database writes are performed by this contract test.
assert.equal(typeof auctionSource, 'string');
assert.equal(typeof schemaSource, 'string');