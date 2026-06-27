const { readFileSync } = require('fs');
const env = readFileSync('.env','utf8').split(/\n/).reduce((a,l)=>{const [k,...v]=l.split('=');if(k)a[k]=v.join('=');return a},{});
process.env.JWT_SECRET=env.JW...
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const s = process.env.JWT_SECRET;
const t = jwt.sign({adminId:1,role:'admin',jti:crypto.randomUUID()}, s, {expiresIn:'1h'});

async function go() {
  const h = {Authorization: 'Bearer '+t};
  const B = 'http://localhost:3001/api/admin';
  let r;
  r = await fetch(B+'/bots/start', {method:'POST',headers:{...h,'Content-Type':'application/json'},body:JSON.stringify({count:5,useExisting:true})}); console.log('START:', JSON.stringify(await r.json()));
  await new Promise(r=>setTimeout(r,10000));
  r = await fetch(B+'/bots', {headers:h});
  const data = await r.json();
  console.log('BOTS:', data.count, 'running:', data.running);
  for (const b of (data.bots||[])) console.log(`  #${b.id} ${b.username}: ${b.actions} действий, ${b.lastAction} → ${b.lastResult}`);
  r = await fetch(B+'/bots/stop', {method:'POST',headers:h}); console.log('STOP:', JSON.stringify(await r.json()));
}
go().catch(e=>console.error(e.message));
