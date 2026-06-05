import { BASE_URL, getHeaders } from './helpers';

export async function fetchJobs() {
    const res = await fetch(`${BASE_URL}/jobs`, { headers: getHeaders() });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка загрузки работ');
    }
    return res.json();
}

export async function startJob(jobId: number) {
    const res = await fetch(`${BASE_URL}/jobs/start`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ jobId }),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка начала работы');
    }
    return res.json();
}

export async function startRandomJob(duration: number) {
    const res = await fetch(`${BASE_URL}/jobs/start-random`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ duration }),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка начала работы');
    }
    return res.json();
}

export async function fetchJobHistory() {
    const res = await fetch(`${BASE_URL}/jobs/history`, { headers: getHeaders() });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка загрузки истории работ');
    }
    return res.json();
}

// Административные
export async function fetchAdminJobs() {
    const res = await fetch(`${BASE_URL}/admin/jobs`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Ошибка загрузки работ (админ)');
    return res.json();
}

export async function createAdminJob(data: any) {
    const res = await fetch(`${BASE_URL}/admin/jobs`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Ошибка создания работы');
    return res.json();
}

export async function updateAdminJob(id: number, data: any) {
    const res = await fetch(`${BASE_URL}/admin/jobs/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Ошибка обновления работы');
    return res.json();
}

export async function deleteAdminJob(id: number) {
    const res = await fetch(`${BASE_URL}/admin/jobs/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Ошибка удаления работы');
    return res.json();
}

export async function adminFinishJob(userId: number) {
    const res = await fetch(`${BASE_URL}/admin/finish-job`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ userId }),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка завершения работы');
    }
    return res.json();
}

export async function adminFinishJobsByJobId(jobId: number) {
    const res = await fetch(`${BASE_URL}/admin/finish-jobs-by-jobid`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ jobId }),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка завершения работ');
    }
    return res.json();
}