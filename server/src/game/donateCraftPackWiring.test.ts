/// <reference types="node" />
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {resolve} from 'node:path';import test from 'node:test';
const body=readFileSync(resolve(__dirname,'../routes/yukassa.ts'),'utf8');
test('craft_rare bypasses legacy delivery through atomic service',()=>{
 const start=body.indexOf("String(existing.item) === 'craft_rare'"); const end=body.indexOf('} else {',start); assert.ok(start>=0&&end>start); const branch=body.slice(start,end);
 assert.match(branch,/processYooKassaCraftRarePayment\(createPgDonateCraftPackRepository\(\)/); assert.doesNotMatch(branch,/processDelivery|deliverCraftPack|db\.run/);
});
test('craft_epic remains in explicit legacy fallback this tracer',()=>{assert.match(body,/else\s*\{[\s\S]*processDelivery\(/);});
test('craft payment notification runs after awaited atomic service',()=>{const call=body.indexOf('await processYooKassaCraftRarePayment(');assert.ok(call>=0);assert.ok(body.indexOf('sendToUser(result.userId',call)>call);});
