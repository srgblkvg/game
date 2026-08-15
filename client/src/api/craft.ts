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

export async function fetchUpgradeInfo(level: number, rarity: number) {
    const res = await fetch(`${BASE_URL}/craft/upgrade-info/${level}/${rarity}`, {
        headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Ошибка загрузки информации об улучшении');
    return res.json();
}

async function readJson(res: Response, fallback: string) {
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || fallback);
    return data;
}

export interface ForgeSelection {
    itemId: string | number;
    targetLevel: number;
}

export async function previewBatchForge(selections: ForgeSelection[]) {
    const res = await fetch(`${BASE_URL}/craft/batch-forge/preview`, {
        method: 'POST', headers: getHeaders(), body: JSON.stringify({ selections }),
    });
    return readJson(res, 'Ошибка расчёта массовой ковки');
}

export async function batchForge(selections: ForgeSelection[], stoneId: string | number) {
    const res = await fetch(`${BASE_URL}/craft/batch-forge`, {
        method: 'POST', headers: getHeaders(), body: JSON.stringify({ selections, stoneId }),
    });
    return readJson(res, 'Ошибка массовой ковки');
}

export async function fetchReforgeInfo(itemId: string | number) {
    const res = await fetch(`${BASE_URL}/craft/reforge-info/${itemId}`, { headers: getHeaders() });
    return readJson(res, 'Ошибка загрузки стоимости перековки');
}

export async function reforgeItem(itemId: string | number, fromStat: string, toStat: string) {
    const res = await fetch(`${BASE_URL}/craft/reforge`, {
        method: 'POST', headers: getHeaders(), body: JSON.stringify({ itemId, fromStat, toStat }),
    });
    return readJson(res, 'Ошибка перековки');
}
