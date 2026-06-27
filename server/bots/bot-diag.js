const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const env = fs.readFileSync('.env','utf8').split(/\n/).reduce((a,l)=>{const[k,...v]=l.split('=');if(k)a[k]=v.join('=');return a},{});
const t = jwt.sign({userId:100,role:'player',isGuest:true,jti:crypto.randomUUID()}, env.JWT_SECRET, {expiresIn:'1h'});

async function test() {
  const h = {Authorization:'Bearer '+t, 'Content-Type':'application/json'};
  let r;
  r = await fetch('http://localhost:3001/api/character/equip', {method:'POST', headers:h, body:JSON.stringify({slotId:'weapon1'})});
  console.log('equip(unequip):', r.status, JSON.stringify(await r.json()));
  r = await fetch('http://localhost:3001/api/auction', {headers:h});
  const d = await r.json();
  console.log('auction:', r.status, Array.isArray(d) ? d.length+' lots' : JSON.stringify(d));
  r = await fetch('http://localhost:3001/api/arena/opponent?difficulty=equal', {headers:h});
  console.log('arena:', r.status, JSON.stringify(await r.json()).slice(0,100));
  r = await fetch('http://localhost:3001/api/tavern/heal', {method:'POST', headers:h, body:JSON.stringify({full:true})});
  console.log('heal:', r.status, JSON.stringify(await r.json()));
}
test().catch(e=>console.error(e));
