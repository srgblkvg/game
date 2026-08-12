const jwt = require('jsonwebtoken');
const http = require('http');

const JWT_SECRET = '7eb7eb13d1ac2929b2ce21135f014bcffb12bdcb5359aaf9f72675a43c286d17';
const token = jwt.sign({userId:1, username:'Некрохирург', role:'player'}, JWT_SECRET, {expiresIn:'1h'});

const data = JSON.stringify({mobId:1});
const req = http.request({
  hostname: 'localhost', port: 3001, path: '/api/mob/attack',
  method: 'POST',
  headers: {'Content-Type':'application/json', 'Authorization':'Bearer '+token}
}, res => {
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => {
    const d = JSON.parse(body);
    if (d.steps) {
      console.log('Total steps:', d.steps.length);
      d.steps.slice(0,10).forEach((s,i) => 
        console.log(i, s.type||'-', (s.hp1||'?')+'/'+(s.maxHp1||'?'), (s.hp2||'?')+'/'+(s.maxHp2||'?'), s.message?.slice(0,60))
      );
    } else console.log('ERR:', JSON.stringify(d).slice(0,400));
  });
});
req.write(data);
req.end();
