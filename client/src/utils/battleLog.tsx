import { Icon } from '@iconify/react';
import { useState } from 'react';

const stepColors: Record<string, string> = {
  damage: 'var(--color-accent-danger)', crit: 'var(--color-text-accent)', dodge: 'var(--color-accent-info)',
  block: 'var(--color-accent-success)', fullBlock: 'var(--color-accent-success)', stun: 'var(--color-accent-purple)',
  counter: 'var(--color-accent-warning)', end: 'var(--color-text-accent)', money: 'var(--color-text-accent)',
  attack: 'var(--color-accent-danger)', info: 'var(--color-text-muted)',
};

const stepIcons: Record<string, string> = {
  attack: 'game-icons:crossed-swords',
  damage: 'game-icons:blood',
  crit: 'game-icons:flame',
  dodge: 'game-icons:sprint',
  block: 'game-icons:shield',
  fullBlock: 'game-icons:shield',
  counter: 'game-icons:backward-time',
  stun: 'game-icons:dizzy',
  end: 'game-icons:trophy',
  money: 'game-icons:cash',
};

interface BattleStep {
  type: string;
  actor?: string;
  message: string;
  damage?: number;
  hp1?: number;
  hp2?: number;
  maxHp1?: number;
  maxHp2?: number;
  stats1?: any;
  stats2?: any;
}

export function renderBattleLog(steps: BattleStep[], compact?: boolean) {
  if (!steps || steps.length === 0) return null;

  const initStep = steps[0];
  const maxHp1 = initStep?.maxHp1 || 100;
  const maxHp2 = initStep?.maxHp2 || 100;
  const stats1 = initStep?.stats1;
  const stats2 = initStep?.stats2;

  let lastActor: string | null = null;
  let lastHp1: number | null = null;
  let lastHp2: number | null = null;

  return (
    <div>
      {/* Character stats header */}
      {stats1 && stats2 && (
        <div className="mb-2 p-2 bg-[var(--color-bg-card)] rounded text-[0.6rem] grid grid-cols-2 gap-2">
          <div>
            <div className="font-bold text-[var(--color-accent-success)]">{stats1.name}</div>
            <div className="text-[var(--color-text-muted)]">ур.{stats1.level} | S:{stats1.S} A:{stats1.A} D:{stats1.D} M:{stats1.M}</div>
            <div className="text-[var(--color-text-muted)]">HP: {stats1.HP}</div>
          </div>
          <div className="text-right">
            <div className="font-bold text-[var(--color-accent-danger)]">{stats2.name}</div>
            <div className="text-[var(--color-text-muted)]">ур.{stats2.level} | S:{stats2.S} A:{stats2.A} D:{stats2.D} M:{stats2.M}</div>
            <div className="text-[var(--color-text-muted)]">HP: {stats2.HP}</div>
          </div>
        </div>
      )}

      {/* HP bars */}
      {initStep?.hp1 != null && (
        <div className="flex gap-3 mb-2 text-[0.6rem]">
          <div className="flex-1">
            <div className="flex justify-between text-[var(--color-text-muted)]">
              <span>{stats1?.name || 'P1'}</span>
              <span className="tabular-nums">{initStep.hp1}/{maxHp1}</span>
            </div>
            <div className="h-1.5 bg-[var(--color-bg-hover)] rounded-full overflow-hidden">
              <div className="h-full bg-[var(--color-accent-success)] rounded-full" style={{ width: `${Math.max(0, initStep.hp1 / maxHp1 * 100)}%` }} />
            </div>
          </div>
          <div className="flex-1">
            <div className="flex justify-between text-[var(--color-text-muted)]">
              <span>{stats2?.name || 'P2'}</span>
              <span className="tabular-nums">{initStep.hp2}/{maxHp2}</span>
            </div>
            <div className="h-1.5 bg-[var(--color-bg-hover)] rounded-full overflow-hidden">
              <div className="h-full bg-[var(--color-accent-danger)] rounded-full" style={{ width: `${Math.max(0, initStep.hp2 / maxHp2 * 100)}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* Battle steps */}
      {steps.map((step, i) => {
        if (i === 0) return null; // Skip initial info (shown in header)
        if (compact && step.type !== 'attack' && step.type !== 'damage' && step.type !== 'end' && step.type !== 'money') return null;

        const isNewTurn = step.actor && step.type === 'attack' && lastActor !== null && step.actor !== lastActor;
        if (step.type === 'attack') lastActor = step.actor ?? null;

        const icon = stepIcons[step.type];
        const hasHp = step.hp1 != null || step.hp2 != null;
        const hpChanged = hasHp && (step.hp1 !== lastHp1 || step.hp2 !== lastHp2);
        if (hasHp) { lastHp1 = step.hp1 ?? lastHp1; lastHp2 = step.hp2 ?? lastHp2; }

        return (
          <div key={i}>
            {isNewTurn && <div className="border-t border-[var(--color-border-light)] my-1" />}
            <div className="mb-0.5 flex items-center gap-1" style={{ color: stepColors[step.type] || 'var(--color-text-muted)' }}>
              {icon && <Icon icon={icon} width="14" height="14" className="flex-shrink-0" />}
              <span className="text-xs">{step.message}</span>
            </div>
            {step.damage != null && (
              <div className="text-[0.55rem] text-[var(--color-text-muted)] ml-5">-{step.damage} HP</div>
            )}
            {hpChanged && (
              <div className="flex gap-3 text-[0.55rem] ml-5">
                <span className="text-[var(--color-accent-success)] tabular-nums">{step.hp1}/{step.maxHp1 || maxHp1}</span>
                <span className="text-[var(--color-accent-danger)] tabular-nums">{step.hp2}/{step.maxHp2 || maxHp2}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
