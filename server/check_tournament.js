const jwt = require('jsonwebtoken');
require('dotenv').config();
const http = require('http');
const token = jwt.sign({ userId: 23, role: 'player', jti: 'x' }, process.env.JWT_SECRET, { expiresIn: '1h' });
http.get('http://localhost:3001/api/tournament', { headers: { 'Authorization': 'Bearer ' + token } }, res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const data = JSON.parse(d);
    if (data.activeTournaments) {
      for (const t of data.activeTournaments) {
        console.log('id:', t.id, 'status:', t.status, 'registrationEnd:', t.registrationEnd, typeof t.registrationEnd);
      }
    }
    if (data.upcoming) console.log('upcoming:', data.upcoming.length);
    console.log('total active:', (data.activeTournaments || []).length);
  });
});
