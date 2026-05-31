import { BASE_URL, getHeaders } from './helpers';

export async function fetchRecipes() {
    const res = await fetch(`${BASE_URL}/craft/recipes`, {
        headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Ошибка загрузки рецептов');
    return res.json();
}

export async function upgradeItem(slots: any[]) {
    const res = await fetch(`${BASE_URL}/craft/upgrade`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ slots }),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка улучшения');
    }
    return res.json();
}

export async function fetchUpgradeInfo(level: number) {
    const res = await fetch(`${BASE_URL}/craft/upgrade-info/${level}`, {
        headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Ошибка загрузки информации об улучшении');
    return res.json();
}