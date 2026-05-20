import { BASE_URL, getHeaders } from './helpers';

export async function fetchShopItems() {
    const res = await fetch(`${BASE_URL}/shop/items`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Ошибка загрузки предметов магазина');
    return res.json();
}

export async function buyItem(itemId: number) {
    const res = await fetch(`${BASE_URL}/shop/buy`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ itemId }),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка покупки');
    }
    return res.json();
}