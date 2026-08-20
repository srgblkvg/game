/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateAuctionListingFee } from './auctionFees';

test('комиссия листинга равна 5% общей стартовой цены стака', () => {
  assert.equal(calculateAuctionListingFee(1_000, 10), 500);
});

test('комиссия округляется вниз и составляет минимум одно серебро', () => {
  assert.equal(calculateAuctionListingFee(21, 1), 1);
  assert.equal(calculateAuctionListingFee(1, 1), 1);
  assert.equal(calculateAuctionListingFee(0, 5), 1);
});
