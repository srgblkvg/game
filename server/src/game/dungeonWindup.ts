export const ENEMY_WINDUP_MS = 800;

export interface EnemyAttackState {
  attackElapsedMs: number;
  attackIntervalMs: number;
  windupStartedAtMs: number | null;
}

export function advanceEnemyAttack(state: EnemyAttackState, nowMs: number): {
  state: EnemyAttackState;
  shouldAttack: boolean;
} {
  if (state.windupStartedAtMs === null) {
    if (state.attackElapsedMs < state.attackIntervalMs) return { state, shouldAttack: false };
    return { state: { ...state, windupStartedAtMs: nowMs }, shouldAttack: false };
  }

  if (nowMs - state.windupStartedAtMs < ENEMY_WINDUP_MS) return { state, shouldAttack: false };
  return {
    state: { ...state, attackElapsedMs: 0, windupStartedAtMs: null },
    shouldAttack: true,
  };
}

export function cancelEnemyWindup(state: EnemyAttackState): EnemyAttackState {
  return { ...state, attackElapsedMs: 0, windupStartedAtMs: null };
}
