import { strict as assert } from 'node:assert';
import test from 'node:test';
import { formatSilverAmount } from './SilverAmount.ts';

test('formats numeric silver with the existing Russian locale', () => {
  assert.equal(formatSilverAmount(1234567), '1 234 567');
  assert.equal(formatSilverAmount(null), '0');
});
