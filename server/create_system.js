require('dotenv').config({quiet:true});
const { db } = require('./dist/db/index');
const bcrypt = require('bcryptjs');
const h = bcrypt.hashSync('yukassa3aJ1up|(a', 10);
db.one('SELECT id FROM users WHERE username = ?', ['yukassa']).then(ex => {
  if (ex) { console.log('exists, id:', ex.id); process.exit(0); }
  return db.run('INSERT INTO users (username,passwordHash,level,currentHp,bases,basea,based,basem,isGuest,emailVerified) VALUES (?,?,?,?,?,?,?,?,?,?)',
    ['yukassa', h, 1, 100, 5, 5, 5, 5, 0, 1]);
}).then(() => {
  console.log('created');
  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
