// Test script for bot API
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const SECRET = process.env.JWT_SECRET;
if (!SECRET) { console.log('NO JWT_SECRET'); process.exit(1); }

const token = jwt.sign({ adminId: 1, role: 'admin', jti: crypto.randomUUID() }, SECRET, { expiresIn: '1h' });
const BASE = 'http://localhost:3001/api/admin';

async function test() {
  // Status
  console.log('=== Status ===');
  let res = await fetch(`${BASE}/bots`, { headers: { Authorization: `Bearer ${token}` } });
  console.log(JSON.stringify(await res.json(), null, 2));

  // Start 2 bots
  console.log('\n=== Start 2 bots ===');
  res = await fetch(`${BASE}/bots/start`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ count: 2, useExisting: true }),
  });
  console.log(JSON.stringify(await res.json(), null, 2));

  // Wait and check status
  await new Promise(r => setTimeout(r, 6000));
  console.log('\n=== Status after 6s ===');
  res = await fetch(`${BASE}/bots`, { headers: { Authorization: `Bearer ${token}` } });
  console.log(JSON.stringify(await res.json(), null, 2));

  // Stop
  console.log('\n=== Stop ===');
  res = await fetch(`${BASE}/bots/stop`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  console.log(JSON.stringify(await res.json(), null, 2));

  // Final status
  console.log('\n=== Final Status ===');
  res = await fetch(`${BASE}/bots`, { headers: { Authorization: `Bearer ${token}` } });
  console.log(JSON.stringify(await res.json(), null, 2));
}

test().catch(e => console.error(e.message));
