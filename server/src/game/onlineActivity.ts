import { db } from '../db/index';

export const MAX_HEARTBEAT_DELTA_SECONDS = 60;

export interface ActivityState {
    sessionId: number;
    pageVisitId: number | null;
    path: string;
    visible: boolean;
    lastHeartbeatAt: number;
}

export function activityDeltaSeconds(previous: number, current: number, visible: boolean): number {
    if (!visible || current <= previous) return 0;
    return Math.min(current - previous, MAX_HEARTBEAT_DELTA_SECONDS);
}

export function normalizeGamePath(rawPath: string): string {
    let path = rawPath || '/';
    try {
        path = new URL(path, 'https://game.local').pathname;
    } catch {
        path = '/';
    }
    path = path.replace(/\/+/g, '/');
    if (!path.startsWith('/')) path = `/${path}`;
    path = path.replace(/^\/profile\/\d+$/, '/profile/:id');
    path = path.replace(/^\/guild\/\d+$/, '/guild/:id');
    path = path.replace(/^\/forum\/\d+$/, '/forum/:id');
    return path.slice(0, 120) || '/';
}

export function normalizeBrowserSessionId(value: unknown): string {
    const id = String(value || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
    return id.length >= 8 ? id : `legacy-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function initOnlineActivity(): Promise<void> {
    await db.raw(`
        CREATE TABLE IF NOT EXISTS game_sessions (
            id BIGSERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL,
            browser_session_id TEXT NOT NULL,
            platform TEXT NOT NULL DEFAULT 'web',
            started_at BIGINT NOT NULL,
            last_heartbeat_at BIGINT NOT NULL,
            ended_at BIGINT,
            active_seconds INTEGER NOT NULL DEFAULT 0,
            end_reason TEXT,
            UNIQUE (user_id, browser_session_id)
        )
    `);
    await db.raw(`
        CREATE TABLE IF NOT EXISTS game_page_visits (
            id BIGSERIAL PRIMARY KEY,
            session_id BIGINT NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL,
            path TEXT NOT NULL,
            started_at BIGINT NOT NULL,
            last_seen_at BIGINT NOT NULL,
            ended_at BIGINT,
            active_seconds INTEGER NOT NULL DEFAULT 0
        )
    `);
    await db.raw('CREATE INDEX IF NOT EXISTS idx_game_sessions_started ON game_sessions(started_at)');
    await db.raw('CREATE INDEX IF NOT EXISTS idx_game_sessions_last_heartbeat ON game_sessions(last_heartbeat_at)');
    await db.raw('CREATE INDEX IF NOT EXISTS idx_game_page_visits_started ON game_page_visits(started_at)');
    await db.raw('CREATE INDEX IF NOT EXISTS idx_game_page_visits_path ON game_page_visits(path)');
}

export async function startOrResumeActivity(
    userId: number,
    browserSessionId: string,
    platform: string,
    now: number,
): Promise<ActivityState> {
    const result = await db.raw(`
        INSERT INTO game_sessions
            (user_id, browser_session_id, platform, started_at, last_heartbeat_at, ended_at, end_reason)
        VALUES ($1, $2, $3, $4, $4, NULL, NULL)
        ON CONFLICT (user_id, browser_session_id) DO UPDATE SET
            platform = EXCLUDED.platform,
            last_heartbeat_at = EXCLUDED.last_heartbeat_at,
            ended_at = NULL,
            end_reason = NULL
        RETURNING id
    `, [userId, browserSessionId, platform.slice(0, 20), now]);

    return {
        sessionId: Number(result.rows[0].id),
        pageVisitId: null,
        path: '/',
        visible: false,
        lastHeartbeatAt: now,
    };
}

async function openPageVisit(state: ActivityState, userId: number, path: string, now: number): Promise<number> {
    const result = await db.raw(`
        INSERT INTO game_page_visits
            (session_id, user_id, path, started_at, last_seen_at)
        VALUES ($1, $2, $3, $4, $4)
        RETURNING id
    `, [state.sessionId, userId, path, now]);
    return Number(result.rows[0].id);
}

export async function recordActivity(
    state: ActivityState,
    userId: number,
    rawPath: string,
    visible: boolean,
    now: number,
): Promise<void> {
    const path = normalizeGamePath(rawPath);
    const delta = activityDeltaSeconds(state.lastHeartbeatAt, now, state.visible);

    if (state.pageVisitId === null) {
        state.pageVisitId = await openPageVisit(state, userId, path, now);
        state.path = path;
    } else if (path !== state.path) {
        await db.raw(`
            UPDATE game_page_visits
            SET last_seen_at = $1, ended_at = $1, active_seconds = active_seconds + $2
            WHERE id = $3
        `, [now, delta, state.pageVisitId]);
        state.pageVisitId = await openPageVisit(state, userId, path, now);
        state.path = path;
    } else {
        await db.raw(`
            UPDATE game_page_visits
            SET last_seen_at = $1, active_seconds = active_seconds + $2
            WHERE id = $3
        `, [now, delta, state.pageVisitId]);
    }

    await db.raw(`
        UPDATE game_sessions
        SET last_heartbeat_at = $1,
            active_seconds = active_seconds + $2,
            ended_at = NULL,
            end_reason = NULL
        WHERE id = $3
    `, [now, delta, state.sessionId]);

    state.visible = visible;
    state.lastHeartbeatAt = now;
}

export async function closeActivity(state: ActivityState, reason: string, now: number): Promise<void> {
    const delta = activityDeltaSeconds(state.lastHeartbeatAt, now, state.visible);
    if (state.pageVisitId !== null) {
        await db.raw(`
            UPDATE game_page_visits
            SET last_seen_at = $1, ended_at = $1, active_seconds = active_seconds + $2
            WHERE id = $3
        `, [now, delta, state.pageVisitId]);
    }
    await db.raw(`
        UPDATE game_sessions
        SET last_heartbeat_at = $1,
            ended_at = $1,
            end_reason = $2,
            active_seconds = active_seconds + $3
        WHERE id = $4
    `, [now, reason.slice(0, 40), delta, state.sessionId]);
    state.visible = false;
    state.lastHeartbeatAt = now;
}
