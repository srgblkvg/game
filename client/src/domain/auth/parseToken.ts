export interface TokenUser {
  id: number;
  username: string;
  level: number;
  role: 'player' | 'admin';
  gender?: string;
  isGuest?: boolean;
}

type TokenPayload = {
  adminId?: unknown;
  userId?: unknown;
  username?: unknown;
  role?: unknown;
  gender?: unknown;
  isGuest?: unknown;
  exp?: unknown;
};

export function parseUserFromToken(token: string): TokenUser | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(
      atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')),
    ) as TokenPayload;
    const id = payload.adminId || payload.userId;

    if ((payload.role !== 'player' && payload.role !== 'admin') || !id) return null;
    if (payload.exp && Number(payload.exp) <= Math.floor(Date.now() / 1000)) return null;

    return {
      id: Number(id),
      username: String(payload.username || ''),
      level: payload.role === 'admin' ? 0 : 1,
      role: payload.role,
      gender: String(payload.gender || 'male'),
      isGuest: Boolean(payload.isGuest || false),
    };
  } catch {
    return null;
  }
}
