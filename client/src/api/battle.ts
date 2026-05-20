import { BASE_URL, getHeaders } from './helpers';

export async function startBattle(opponentId?: number) {
    const res = await fetch(`${BASE_URL}/battle`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ opponentId: opponentId || null }),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка боя');
    }
    return res.json();
}

export async function fetchBattles(limit = 10) {
    const res = await fetch(`${BASE_URL}/battles?limit=${limit}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Ошибка загрузки истории боёв');
    return res.json();
}

export async function enterArena() {
    const res = await fetch(`${BASE_URL}/arena/enter`, {
        method: 'POST',
        headers: getHeaders(),
        body: '{}',
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка входа на арену');
    }
    return res.json();
}

export async function checkOpponent() {
    const res = await fetch(`${BASE_URL}/arena/check-opponent`, { headers: getHeaders() });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Нет доступных соперников');
    }
    return res.json();
}