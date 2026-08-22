/// <reference types="node" />
import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {resolve} from 'node:path';import test from 'node:test';const body=readFileSync(resolve(__dirname,'../routes/yukassa.ts'),'utf8');
test('Yoo premium bypasses legacy processDelivery',()=>{const start=body.indexOf("localItem.type === 'premium'");const end=body.indexOf("localItem.type === 'silver'",start);assert.ok(start>=0&&end>start);const branch=body.slice(start,end);assert.match(branch,/await processYooKassaPremiumPayment\(createPgDonatePremiumRepository\(\)/);assert.doesNotMatch(branch,/processDelivery|db\.run/);assert.match(branch,/until:\s*result\.premiumUntil/);});
test('legacy days request сохраняет canonical premium SKU локально',()=>{
 assert.match(body,/const canonicalItemKey = itemKey \|\| `premium_\$\{days\}d`/);
 assert.match(body,/\[payment\.id, userId, canonicalItemKey,/);
});
