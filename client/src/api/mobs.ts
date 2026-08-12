import { BASE_URL, getHeaders } from './helpers';

export async function fetchMobs() {
    const res = await fetch(`${BASE_URL}/mobs`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Ошибка загрузки мобов');
    return res.json();
}

export async function attackMob(mobId: number) {
    const res = await fetch(`${BASE_URL}/mob/attack`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ mobId }),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка атаки');
    }
    return res.json();
}
