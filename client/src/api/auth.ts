import { BASE_URL } from './helpers';

export async function register(username: string, email: string, password: string) {
    const res = await fetch(`${BASE_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.error || 'Ошибка регистрации');
    }
    return data;
}

export async function verifyEmail(email: string, code: string) {
    const res = await fetch(`${BASE_URL}/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.error || 'Ошибка подтверждения');
    }
    return data;
}

export async function resendCode(email: string, token?: string) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${BASE_URL}/resend-code`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.error || 'Ошибка отправки');
    }
    return data;
}

export async function login(username: string, password: string) {
    const res = await fetch(`${BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка входа');
    }
    return res.json();
}

export async function guestLogin(nickname?: string) {
    const res = await fetch(`${BASE_URL}/guest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nickname ? { nickname } : {}),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка гостевого входа');
    }
    return res.json();
}
