const jwt = require('jsonwebtoken');
require('dotenv').config();
const http = require('http');
const token = jwt.sign({ userId: 23, role: 'player', jti: 'x' }, process.env.JWT_SECRET, { expiresIn: '1h' });
http.get('http://localhost:3001/api/character/public/23', { headers: { 'Authorization': 'Bearer ' + token } }, res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const u = JSON.parse(d);
    const fields = ['totalBattles','wins','pveTotalBattles','pveWins','totalPvpMoneyWon','totalPvpMoneyLost','totalPveMoneyWon','totalPveMoneyLost','totalJobMoney','totalJobSeconds','craftCreated','craftUpgraded','craftBroken'];
    for (const f of fields) console.log(f + ':', u[f]);
  });
});
