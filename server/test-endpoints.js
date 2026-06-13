const http = require('http');

function req(method, path, token, data) {
  return new Promise((resolve) => {
    const opts = {hostname:'localhost', port:3002, path, method, headers:{'Content-Type':'application/json'}};
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    const r = http.request(opts, res => {
      let b = ''; res.on('data', c => b += c);
      res.on('end', () => resolve({status: res.statusCode, body: b.substring(0, 300)}));
    });
    if (data) r.write(JSON.stringify(data));
    r.end();
    setTimeout(() => resolve({status: 0, body: 'timeout'}), 5000);
  });
}

(async () => {
  // Login
  const login = await req('POST', '/api/login', null, {username:'hermes_test',password:'testtest'});
  console.log('LOGIN:', login.status, login.body.substring(0, 100));
  const token = JSON.parse(login.body).token;
  
  // Test endpoints
  for (const [label, path] of [['SHOP','/api/shop/items'], ['MOBS','/api/mobs'], ['TOURNAMENT','/api/tournament'], ['GUILD','/api/guild/list'], ['RATING','/api/rating?page=1&limit=3'], ['TAVERN','/api/tavern/quests'], ['BATTLES','/api/battles?limit=1']]) {
    const r = await req('GET', path, token);
    const d = JSON.parse(r.body);
    const info = Array.isArray(d) ? `array[${d.length}]` : (d.error ? `ERROR:${d.error}` : `obj{${Object.keys(d).length}}`);
    console.log(`${label}: HTTP ${r.status} ${info}`);
  }
})();
