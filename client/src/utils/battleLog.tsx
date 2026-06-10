import { Icon } from '@iconify/react';

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
}

export function renderBattleLog(steps: BattleStep[]) {
  let lastActor: string | null = null;

  return steps.map((step, i) => {
    const isNewTurn =
      step.actor &&
      step.type === 'attack' &&
      lastActor !== null &&
      step.actor !== lastActor;

    if (step.type === 'attack') lastActor = step.actor ?? null;

    const icon = stepIcons[step.type];

    return (
      <div key={i}>
        {isNewTurn && (
          <div className="border-t border-[var(--color-bg-input)] my-1" />
        )}
        <div className="mb-0.5 flex items-center gap-1" style={{ color: stepColors[step.type] || 'var(--color-text-muted)' }}>
          {icon && <Icon icon={icon} width="14" height="14" className="flex-shrink-0" />}
          <span>{step.message}</span>
        </div>
      </div>
    );
  });
}
