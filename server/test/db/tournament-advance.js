require('dotenv').config();
const path = require('path');
const { db } = require(path.resolve(__dirname, '../../dist/db/index'));

async function autoAdvance(tournamentId) {
    const t = await db.one('SELECT * FROM tournaments WHERE id = $1', [tournamentId]);
    if (!t) { console.log('NOT FOUND'); return; }
    console.log('t.id:', t.id, 'status:', t.status, 'registrationEnd:', t.registrationEnd, 'type:', typeof t.registrationEnd);
    console.log('t keys:', Object.keys(t).filter(k => k.includes('nd') || k.includes('eg')));

    const now = Math.floor(Date.now() / 1000);
    console.log('now:', now, 'now >= regEnd:', now >= t.registrationEnd);

    if (t.status === 'registration' && now >= t.registrationEnd) {
        console.log('WOULD ADVANCE');
    }
}
autoAdvance(585).then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });