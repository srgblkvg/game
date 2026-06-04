import { BASE_URL, getHeaders } from './helpers';

// Предметы
export async function fetchAdminItems() {
    const res = await fetch(`${BASE_URL}/admin/items`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Ошибка загрузки предметов');
    return res.json();
}

export async function createAdminItem(data: any) {
    const res = await fetch(`${BASE_URL}/admin/items`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Ошибка создания предмета');
    return res.json();
}

export async function updateAdminItem(id: number, data: any) {
    const res = await fetch(`${BASE_URL}/admin/items/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Ошибка обновления предмета');
    return res.json();
}

export async function deleteAdminItem(id: number) {
    const res = await fetch(`${BASE_URL}/admin/items/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Ошибка удаления предмета');
    return res.json();
}

// Игроки
export async function fetchAdminUsers() {
    const res = await fetch(`${BASE_URL}/admin/users`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Ошибка загрузки пользователей');
    return res.json();
}

export async function addMoneyToUser(userId: number, amount: number) {
    const res = await fetch(`${BASE_URL}/admin/add-money`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ userId, amount }),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка пополнения');
    }
    return res.json();
}

export async function fetchAdminChatMessages(limit = 200) {
    const res = await fetch(`${BASE_URL}/admin/chat-messages?limit=${limit}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Ошибка загрузки сообщений чата');
    return res.json();
}

export async function deleteChatMessage(id: number) {
    const res = await fetch(`${BASE_URL}/admin/chat-messages/${id}`, { method: 'DELETE', headers: getHeaders() });
    if (!res.ok) throw new Error('Ошибка удаления сообщения');
    return res.json();
}

export async function deleteAllChatMessages() {
    const res = await fetch(`${BASE_URL}/admin/chat-messages`, { method: 'DELETE', headers: getHeaders() });
    if (!res.ok) throw new Error('Ошибка удаления всех сообщений');
    return res.json();
}

export async function blockUserInChat(userId: number, minutes: number) {
    const res = await fetch(`${BASE_URL}/admin/chat-block`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ userId, minutes }),
    });
    if (!res.ok) throw new Error('Ошибка блокировки чата');
    return res.json();
}

// ==================== Craft items (ресурсы) ====================
export async function fetchAdminCraftItems() {
    const res = await fetch(`${BASE_URL}/admin/craft-items`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Ошибка загрузки ресурсов');
    return res.json();
}

export async function createCraftItem(data: any) {
    const res = await fetch(`${BASE_URL}/admin/craft-items`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Ошибка создания ресурса');
    return res.json();
}

export async function updateCraftItem(id: number, data: any) {
    const res = await fetch(`${BASE_URL}/admin/craft-items/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Ошибка обновления ресурса');
    return res.json();
}

export async function deleteCraftItem(id: number) {
    const res = await fetch(`${BASE_URL}/admin/craft-items/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Ошибка удаления ресурса');
    return res.json();
}

// ==================== Craft recipes (рецепты) ====================
export async function fetchAdminRecipes() {
    const res = await fetch(`${BASE_URL}/admin/recipes`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Ошибка загрузки рецептов');
    return res.json();
}

export async function createRecipe(data: any) {
    const res = await fetch(`${BASE_URL}/admin/recipes`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Ошибка создания рецепта');
    return res.json();
}

export async function updateRecipe(id: number, data: any) {
    const res = await fetch(`${BASE_URL}/admin/recipes/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Ошибка обновления рецепта');
    return res.json();
}

export async function deleteRecipe(id: number) {
    const res = await fetch(`${BASE_URL}/admin/recipes/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Ошибка удаления рецепта');
    return res.json();
}

// ==================== Категории рецептов ====================
export async function fetchRecipeCategories() {
    const res = await fetch(`${BASE_URL}/admin/recipe-categories`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Ошибка загрузки категорий');
    return res.json();
}

export async function createRecipeCategory(data: any) {
    const res = await fetch(`${BASE_URL}/admin/recipe-categories`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Ошибка создания категории');
    return res.json();
}

export async function updateRecipeCategory(id: number, data: any) {
    const res = await fetch(`${BASE_URL}/admin/recipe-categories/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Ошибка обновления категории');
    return res.json();
}

export async function deleteRecipeCategory(id: number) {
    const res = await fetch(`${BASE_URL}/admin/recipe-categories/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Ошибка удаления категории');
    return res.json();
}

// ==================== Upgrade chances (шансы улучшения) ====================
export async function fetchUpgradeChances() {
    const res = await fetch(`${BASE_URL}/admin/upgrade-chances`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Ошибка загрузки шансов улучшения');
    return res.json();
}

export async function createUpgradeChance(data: any) {
    const res = await fetch(`${BASE_URL}/admin/upgrade-chances`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Ошибка создания шанса улучшения');
    return res.json();
}

export async function updateUpgradeChance(level: number, data: any) {
    const res = await fetch(`${BASE_URL}/admin/upgrade-chances/${level}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Ошибка обновления шанса улучшения');
    return res.json();
}

export async function deleteUpgradeChance(level: number) {
    const res = await fetch(`${BASE_URL}/admin/upgrade-chances/${level}`, {
        method: 'DELETE',
        headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Ошибка удаления шанса улучшения');
    return res.json();
}

// Смена пароля администратора
export async function changeAdminPassword(oldPassword: string, newPassword: string) {
    const res = await fetch(`${BASE_URL}/admin/change-password`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ oldPassword, newPassword }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка смены пароля');
    return data;
}

// Бан игрока
export async function banUser(userId: number, duration: number, unit: 'minutes' | 'hours' | 'days') {
    const res = await fetch(`${BASE_URL}/admin/ban-user`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ userId, duration, unit }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка бана');
    return data;
}

// Разбан игрока
export async function unbanUser(userId: number) {
    const res = await fetch(`${BASE_URL}/admin/unban-user`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ userId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка разбана');
    return data;
}

// Удаление игрока
export async function deleteUser(userId: number) {
    const res = await fetch(`${BASE_URL}/admin/users/${userId}`, {
        method: 'DELETE',
        headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка удаления');
    return data;
}

// IP-адреса игрока
export async function fetchUserIps(userId: number) {
    const res = await fetch(`${BASE_URL}/admin/users/${userId}/ips`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Ошибка загрузки IP');
    return res.json();
}