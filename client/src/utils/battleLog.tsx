const stepColors: Record<string, string> = {
  damage: '#e74c3c', crit: '#f1c40f', dodge: '#3498db',
  block: '#2ecc71', fullBlock: '#2ecc71', stun: '#9b59b6',
  counter: '#e67e22', end: '#f1c40f', money: '#f1c40f',
  attack: '#e74c3c', info: '#aaa',
};

interface BattleStep {
  type: string;
  actor?: string;
  message: string;
}

/**
 * Рендерит шаги боя с визуальным разделением ходов.
 */
export function renderBattleLog(steps: BattleStep[]) {
  let lastActor: string | null = null;

  return steps.map((step, i) => {
    const isNewTurn =
      step.actor &&
      step.type === 'attack' &&
      lastActor !== null &&
      step.actor !== lastActor;

    if (step.type === 'attack') lastActor = step.actor ?? null;

    return (
      <div key={i}>
        {isNewTurn && (
          <div className="border-t border-[#333] my-1" />
        )}
        <div className="mb-0.5" style={{ color: stepColors[step.type] || '#aaa' }}>
          {step.message}
        </div>
      </div>
    );
  });
}
