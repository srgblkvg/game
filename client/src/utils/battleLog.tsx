import { Icon } from '@iconify/react';

const stepColors: Record<string, string> = {
  damage: '#e74c3c', crit: '#f1c40f', dodge: '#3498db',
  block: '#2ecc71', fullBlock: '#2ecc71', stun: '#9b59b6',
  counter: '#e67e22', end: '#f1c40f', money: '#f1c40f',
  attack: '#e74c3c', info: '#aaa',
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
          <div className="border-t border-[#333] my-1" />
        )}
        <div className="mb-0.5 flex items-center gap-1" style={{ color: stepColors[step.type] || '#aaa' }}>
          {icon && <Icon icon={icon} width="14" height="14" className="flex-shrink-0" />}
          <span>{step.message}</span>
        </div>
      </div>
    );
  });
}
