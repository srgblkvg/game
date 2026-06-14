const https = require('https');
const agent = new https.Agent({ keepAlive: true, rejectUnauthorized: false, maxSockets: 50 });
const BASE = 'https://mmoarena.ru';

async function api(method, path, token, body) {
  return new Promise((resolve) => {
    const start = Date.now();
    const url = new URL(path, BASE);
    const opts = {
      method, hostname: url.hostname, path: url.pathname + url.search,
      headers: { 'Content-Type': 'application/json' },
      agent, rejectUnauthorized: false
    };
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    const rq = https.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        const ms = Date.now() - start;
        let parsed = null;
        try { parsed = JSON.parse(d); } catch {}
        resolve({ status: res.statusCode, ms, body: parsed, error: res.statusCode >= 500 ? d.slice(0, 100) : null });
      });
    });
    rq.on('error', e => resolve({ status: 0, ms: Date.now() - start, error: e.message }));
    if (body) rq.write(JSON.stringify(body));
    rq.end();
  });
}

async function main() {
  // 1. Login
  console.log('LOGIN...');
  const l = await api('POST', '/api/login', null, { username: 'srgblkvvl', password: '***' });
  if (!l.body?.token) { console.log('LOGIN FAIL:', JSON.stringify(l)); return; }
  const token = l.body.token;
  console.log('OK, token:', token.slice(0, 20) + '...');

  // 2. Stress test — 5 rounds, all endpoints
  const endpoints = [
    ['GET', '/api/character/me'],
    ['GET', '/api/floors'],
    ['GET', '/api/mobs'],
    ['GET', '/api/shop/items'],
    ['GET', '/api/rating?page=1&limit=20'],
    ['GET', '/api/tavern'],
    ['GET', '/api/jobs'],
    ['GET', '/api/bank'],
    ['GET', '/api/auction'],
    ['GET', '/api/guild/list'],
    ['GET', '/api/collections'],
    ['GET', '/api/tournament'],
    ['GET', '/api/orders'],
    ['GET', '/api/actions'],
    ['GET', '/api/users/list?ids=23,31,47'],
    ['GET', '/api/character/public/23'],
    ['GET', '/api/character/public/31'],
    ['GET', '/api/battles?limit=5'],
    ['GET', '/api/stat-names'],
    ['GET', '/api/chat/recent?limit=5'],
    ['GET', '/api/quests'],
    ['GET', '/api/log/tournament-history?limit=5'],
  ];

  const ROUNDS = 10;
  const CONCURRENT = 10;
  
  console.log(`\nSTRESS: ${endpoints.length} endpoints × ${ROUNDS} rounds × ${CONCURRENT} concurrent...\n`);
  
  let totalOk = 0, totalFail = 0, totalMs = 0, maxMs = 0;
  const errCounts = {};

  for (let round = 0; round < ROUNDS; round++) {
    const batch = [];
    for (const [method, path] of endpoints) {
      for (let c = 0; c < CONCURRENT; c++) {
        batch.push(api(method, path, token));
      }
    }
    const results = await Promise.all(batch);
    
    let ok = 0, fail = 0;
    for (const r of results) {
      totalMs += r.ms;
      if (r.ms > maxMs) maxMs = r.ms;
      if (r.status >= 200 && r.status < 400) ok++;
      else { fail++; const k = r.status + ' ' + (r.error || '').slice(0, 40); errCounts[k] = (errCounts[k] || 0) + 1; }
    }
    totalOk += ok; totalFail += fail;
    const avg = Math.round(totalMs / results.length);
    process.stdout.write(`  round ${round + 1}/${ROUNDS}: ${ok} ok, ${fail} fail | avg ${avg}ms | max ${maxMs}ms\r`);
  }
  
  console.log(`\n\n=== SUMMARY ===`);
  console.log(`Total requests: ${totalOk + totalFail}`);
  console.log(`OK: ${totalOk}, FAIL: ${totalFail}`);
  console.log(`Avg time: ${Math.round(totalMs / (totalOk + totalFail))}ms, Max: ${maxMs}ms`);
  console.log(`Errors:`);
  for (const [k, v] of Object.entries(errCounts).slice(0, 10)) console.log(`  ${k}: ${v}`);
}

main().catch(e => console.error(e));
