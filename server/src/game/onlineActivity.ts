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
    await db.raw('SELECT id, user_id, browser_session_id, platform, started_at, last_heartbeat_at, ended_at, active_seconds, end_reason FROM game_sessions LIMIT 0');
    await db.raw('SELECT id, session_id, user_id, path, started_at, last_seen_at, ended_at, active_seconds FROM game_page_visits LIMIT 0');
    const readiness = await db.raw(`
        SELECT
            EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conrelid = 'game_sessions'::regclass
                  AND contype = 'u'
                  AND pg_get_constraintdef(oid) = 'UNIQUE (user_id, browser_session_id)'
            )
            AND EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conrelid = 'game_page_visits'::regclass
                  AND contype = 'f'
                  AND pg_get_constraintdef(oid) = 'FOREIGN KEY (session_id) REFERENCES game_sessions(id) ON DELETE CASCADE'
            )
            AND EXISTS (
                SELECT 1 FROM pg_indexes WHERE schemaname = 'public'
                  AND indexname = 'idx_game_sessions_started' AND indexdef LIKE '%(started_at)'
            )
            AND EXISTS (
                SELECT 1 FROM pg_indexes WHERE schemaname = 'public'
                  AND indexname = 'idx_game_sessions_last_heartbeat' AND indexdef LIKE '%(last_heartbeat_at)'
            )
            AND EXISTS (
                SELECT 1 FROM pg_indexes WHERE schemaname = 'public'
                  AND indexname = 'idx_game_page_visits_started' AND indexdef LIKE '%(started_at)'
            )
            AND EXISTS (
                SELECT 1 FROM pg_indexes WHERE schemaname = 'public'
                  AND indexname = 'idx_game_page_visits_path' AND indexdef LIKE '%(path)'
            )
            AND has_table_privilege(current_user, 'game_sessions', 'INSERT')
            AND has_table_privilege(current_user, 'game_sessions', 'UPDATE')
            AND has_table_privilege(current_user, 'game_page_visits', 'INSERT')
            AND has_table_privilege(current_user, 'game_page_visits', 'UPDATE')
            AND has_sequence_privilege(current_user, 'game_sessions_id_seq', 'USAGE')
            AND has_sequence_privilege(current_user, 'game_page_visits_id_seq', 'USAGE')
            AS ready
    `);
    if (readiness.rows[0]?.ready !== true) {
        throw new Error('online activity schema readiness failed');
    }
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
