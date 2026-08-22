/// <reference types="node" />
import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {resolve} from 'node:path';import test from 'node:test';
const body=readFileSync(resolve(__dirname,'../routes/vkPayments.ts'),'utf8');
test('VK craft_pack bypasses legacy delivery and returns after atomic service',()=>{const start=body.indexOf("item.type === 'craft_pack'");const end=body.indexOf("item.type === 'curse_pack'",start);assert.ok(start>=0&&end>start);const branch=body.slice(start,end);assert.match(branch,/processVkCraftPackPayment\(createPgVkCraftPackRepository\(\)/);assert.doesNotMatch(branch,/deliverCraftPack|processed\s*=|db\.run/);assert.match(branch,/return res\.json\(\{ response/);});
test('VK craft pack uses signed provider item_price',()=>{assert.match(body,/processVkCraftPackPayment[\s\S]*providerPrice:\s*Number\(params\.item_price\)/);});
