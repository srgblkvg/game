import { BASE_URL, getHeaders } from './helpers';

export async function fetchCharacter() {
    const res = await fetch(`${BASE_URL}/character/me`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to load character');
    return res.json();
}

export async function saveCharacter(character: any) {
    const res = await fetch(`${BASE_URL}/character/save`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(character),
    });
    return res.json();
}

export async function equipItem(slotId: string, itemId?: string) {
    const res = await fetch(`${BASE_URL}/character/equip`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ slotId, itemId: itemId || null }),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка экипировки');
    }
    return res.json();
}

export async function salvageItems(itemIds: string[]) {
    const res = await fetch(`${BASE_URL}/character/salvage`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ itemIds }),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка разбора');
    }
    return res.json();
}

export async function expandInventory() {
    const res = await fetch(`${BASE_URL}/character/expand-inventory`, {
        method: 'POST',
        headers: getHeaders(),
        body: '{}',
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка расширения инвентаря');
    }
    return res.json();
}

export async function fetchPublicProfile(userId: number) {
    const res = await fetch(`${BASE_URL}/character/public/${userId}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Ошибка загрузки профиля');
    return res.json();
}

export async function fetchRating(page = 1, limit = 20, search = '', minElo = 0, maxElo = 0) {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.set('search', search);
    if (minElo) params.set('minElo', String(minElo));
    if (maxElo) params.set('maxElo', String(maxElo));
    const res = await fetch(`${BASE_URL}/rating?${params}`, {
        headers: getHeaders()
    });
    if (!res.ok) throw new Error('Ошибка загрузки рейтинга');
    const data = await res.json();
    return { users: data.users, total: data.total, myPage: data.myPage || 1 };
}

export async function fetchUsersByIds(ids: number[]) {
    if (ids.length === 0) return [];
    const res = await fetch(`${BASE_URL}/users/list?ids=${ids.join(',')}`, {
        headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Ошибка загрузки пользователей');
    return res.json();
}

export async function saveOpenTabs(tabs: number[]) {
    const res = await fetch(`${BASE_URL}/character/save-tabs`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ tabs }),
    });
    if (!res.ok) throw new Error('Ошибка сохранения вкладок');
    return res.json();
}

export async function allocateStats(s: number, a: number, d: number, m: number) {
    const res = await fetch(`${BASE_URL}/character/allocate-stats`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ s, a, d, m }),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка распределения');
    }
    return res.json();
}