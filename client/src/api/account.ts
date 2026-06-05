import { BASE_URL, getHeaders } from './helpers';

export async function changeUsername(newUsername: string) {
    const res = await fetch(`${BASE_URL}/account/change-username`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ newUsername }),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка смены имени');
    }
    return res.json();
}

export async function changePassword(oldPassword: string, newPassword: string) {
    const res = await fetch(`${BASE_URL}/account/change-password`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ oldPassword, newPassword }),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка смены пароля');
    }
    return res.json();
}

export async function changeGender(gender: 'male' | 'female') {
    const res = await fetch(`${BASE_URL}/account/change-gender`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ gender }),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка смены пола');
    }
    return res.json();
}

export async function deleteAccount(currentPassword: string) {
    const res = await fetch(`${BASE_URL}/account/delete`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ currentPassword }),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка удаления аккаунта');
    }
    return res.json();
}

export async function registerGuest(username: string, password: string, email: string, code: string) {
    const res = await fetch(`${BASE_URL}/account/register-guest`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ username, password, email, code }),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка регистрации');
    }
    return res.json();
}