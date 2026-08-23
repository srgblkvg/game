/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { applyInventoryRecipe, serializeInventoryJson } from './donateInventoryRecipe';

const ruby={id:21,name:'Руна Рубина',rarityId:6,type:'upgrade',image:'/ruby',rarityDisplay:'Мифический',rarityColor:'#f00'};
const topaz={id:22,name:'Руна Топаза',rarityId:5,type:'upgrade',image:'/topaz',rarityDisplay:'Легендарный',rarityColor:'#fa0'};
const amethyst={id:23,name:'Руна Аметиста',rarityId:4,type:'upgrade',image:'/amethyst',rarityDisplay:'Эпический',rarityColor:'#a0f'};
const recipe={entries:[{name:'Руна Рубина',count:1},{name:'Руна Топаза',count:1},{name:'Руна Аметиста',count:1}],bankDelta:0};

test('recipe стакает существующий и добавляет новые canonical craft_item',()=>{
 const result=applyInventoryRecipe(JSON.stringify([{type:'craft_item',id:21,count:2}]),[ruby,topaz,amethyst],recipe,3);
 assert.equal(result.ok,true);if(!result.ok)return;
 assert.equal(result.inventory.find((i:any)=>i.id===21).count,5);
 assert.equal(result.inventory.find((i:any)=>i.id===22).count,3);
 assert.equal(result.inventory.find((i:any)=>i.id===23).count,3);
 assert.equal(result.bankDelta,0);
});

test('missing или duplicate catalog отклоняет весь recipe',()=>{
 assert.equal(applyInventoryRecipe('[]',[ruby,topaz],recipe,1).ok,false);
 assert.equal(applyInventoryRecipe('[]',[ruby,{...ruby,id:99},topaz,amethyst],recipe,1).ok,false);
});

test('разные обязательные имена не могут ссылаться на один catalog id',()=>{
 assert.equal(applyInventoryRecipe('[]',[ruby,{...topaz,id:ruby.id},amethyst],recipe,1).ok,false);
});

test('malformed authoritative catalog record отклоняет recipe',()=>{
 assert.equal(applyInventoryRecipe('[]',[{...ruby,id:0},topaz,amethyst],recipe,1).ok,false);
 assert.equal(applyInventoryRecipe('[]',[ruby,{...topaz,rarityId:NaN},amethyst],recipe,1).ok,false);
 assert.equal(applyInventoryRecipe('[]',[ruby,{...topaz,rarityId:-1},amethyst],recipe,1).ok,false);
 assert.equal(applyInventoryRecipe('[]',[ruby,topaz,{...amethyst,type:''}],recipe,1).ok,false);
});

test('базовая редкость 0 является валидной authoritative catalog записью',()=>{
 const stone={...ruby,id:11,name:'Рунный булыжник',rarityId:0,rarityDisplay:'Хлам'};
 const result=applyInventoryRecipe('[]',[stone],{entries:[{name:stone.name,count:6}],bankDelta:10000});
 assert.equal(result.ok,true);
 if(result.ok){assert.equal(result.inventory[0].rarity_id,0);assert.equal(result.inventory[0].count,6);}
});

test('malformed или duplicate inventory stack отклоняет весь recipe',()=>{
 assert.equal(applyInventoryRecipe('{bad',[ruby,topaz,amethyst],recipe,1).ok,false);
 assert.equal(applyInventoryRecipe(JSON.stringify([{type:'craft_item',id:21,count:'bad'}]),[ruby,topaz,amethyst],recipe,1).ok,false);
 assert.equal(applyInventoryRecipe(JSON.stringify([{type:'craft_item',id:21,count:'2'}]),[ruby,topaz,amethyst],recipe,1).ok,false);
 assert.equal(applyInventoryRecipe(JSON.stringify([{type:'craft_item',id:21,count:1},{type:'material',id:21,count:2}]),[ruby,topaz,amethyst],recipe,1).ok,false);
});

test('multiplier обязан быть положительным целым',()=>{
 assert.equal(applyInventoryRecipe('[]',[ruby,topaz,amethyst],recipe,0).ok,false);
 assert.equal(applyInventoryRecipe('[]',[ruby,topaz,amethyst],recipe,1.5).ok,false);
});

test('serializer preserves SQL NULL as JSON null',()=>{
 assert.equal(serializeInventoryJson(null),'null');
 assert.equal(serializeInventoryJson(undefined),'null');
 assert.equal(serializeInventoryJson([]),'[]');
 assert.equal(serializeInventoryJson('[{"id":1}]'),'[{"id":1}]');
});
