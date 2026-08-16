export interface TournamentQueueParticipant {
  userId: number;
  combatPower: number;
}

export interface TournamentQueue {
  id: number;
  participants: TournamentQueueParticipant[];
}

export interface TournamentQueueGroup {
  sourceQueueIds: number[];
  participants: TournamentQueueParticipant[];
}

export interface TournamentQueueMergeOptions {
  maxPlayers: number;
  maxPowerGap: number;
}

export interface TournamentQueueMergeResult {
  groups: TournamentQueueGroup[];
  cancelledParticipants: TournamentQueueParticipant[];
  cancelledQueueIds: number[];
}

export interface PowerDivision {
  key: string;
  label: string;
  number: number;
  minPower: number;
  maxPower: number;
}

const DIVISION_GAP = 0.05;

const VISIBLE_POWER_RANKS = [
  { name: 'Медный', min: 1, max: 100 },
  { name: 'Бронзовый', min: 100, max: 500 },
  { name: 'Железный', min: 500, max: 2_500 },
  { name: 'Стальной', min: 2_500, max: 10_000 },
  { name: 'Серебряный', min: 10_000, max: 50_000 },
  { name: 'Золотой', min: 50_000, max: 250_000 },
  { name: 'Платиновый', min: 250_000, max: 1_250_000 },
  { name: 'Мифриловый', min: 1_250_000, max: 6_250_000 },
  { name: 'Адамантовый', min: 6_250_000, max: 31_250_000 },
  { name: 'Орихалковый', min: 31_250_000, max: Number.POSITIVE_INFINITY },
];
const ROMAN_TIERS = ['I', 'II', 'III', 'IV', 'V'];

/** Понятное игроку название ранга; технические 5%-диапазоны скрыты. */
export function getVisiblePowerDivision(combatPower: number): string {
  const power = Math.max(1, Math.round(combatPower));
  const rank = VISIBLE_POWER_RANKS.find(candidate => power < candidate.max)
    || VISIBLE_POWER_RANKS[VISIBLE_POWER_RANKS.length - 1]!;
  if (!Number.isFinite(rank.max)) return `${rank.name} V`;
  const progress = Math.max(0, Math.min(0.999999, (power - rank.min) / (rank.max - rank.min)));
  return `${rank.name} ${ROMAN_TIERS[Math.floor(progress * ROMAN_TIERS.length)]}`;
}

/** Узкая ступень БМ; соседние границы непрерывны, ширина не превышает 5%. */
export function getPowerDivision(combatPower: number): PowerDivision {
  const power = Math.max(1, Math.round(combatPower));
  let minPower = 1;
  let number = 1;
  while (true) {
    const maxPower = Math.max(minPower, Math.floor(minPower / (1 - DIVISION_GAP)));
    if (power <= maxPower) {
      return { key: `bronze-${number}`, label: getVisiblePowerDivision(power), number, minPower, maxPower };
    }
    minPower = maxPower + 1;
    number++;
  }
}

export interface FundedTournamentQueue extends TournamentQueue {
  prizePool: number;
}

export interface QueueMergePlanGroup {
  hostQueueId: number;
  donorQueueIds: number[];
  prizePool: number;
  userIds: number[];
}

export function buildQueueMergePlan(
  queues: FundedTournamentQueue[],
  options: TournamentQueueMergeOptions,
): { groups: QueueMergePlanGroup[]; cancelledQueueIds: number[] } {
  const merged = mergeTournamentQueues(queues, options);
  const funds = new Map(queues.map(queue => [queue.id, queue.prizePool]));
  return {
    groups: merged.groups.map(group => {
      const sourceQueueIds = [...group.sourceQueueIds].sort((a, b) => a - b);
      const hostQueueId = sourceQueueIds[0]!;
      return {
        hostQueueId,
        donorQueueIds: sourceQueueIds.slice(1),
        prizePool: sourceQueueIds.reduce((sum, id) => sum + (funds.get(id) || 0), 0),
        userIds: group.participants.map(participant => participant.userId),
      };
    }),
    cancelledQueueIds: merged.cancelledQueueIds,
  };
}

export function getPowerDivisionByNumber(number: number): PowerDivision {
  const target = Math.max(1, Math.floor(number));
  let minPower = 1;
  for (let current = 1; current < target; current++) {
    const maxPower = Math.max(minPower, Math.floor(minPower / (1 - DIVISION_GAP)));
    minPower = maxPower + 1;
  }
  const maxPower = Math.max(minPower, Math.floor(minPower / (1 - DIVISION_GAP)));
  return { key: `bronze-${target}`, label: getVisiblePowerDivision(Math.round((minPower + maxPower) / 2)), number: target, minPower, maxPower };
}

function relativeGap(minPower: number, maxPower: number): number {
  return maxPower <= 0 ? 0 : (maxPower - minPower) / maxPower;
}

export function mergeTournamentQueues(
  queues: TournamentQueue[],
  options: TournamentQueueMergeOptions,
): TournamentQueueMergeResult {
  const maxPlayers = Math.max(2, Math.floor(options.maxPlayers));
  const entries = queues
    .flatMap(queue => queue.participants.map(participant => ({ ...participant, queueId: queue.id })))
    .sort((a, b) => a.combatPower - b.combatPower || a.userId - b.userId);

  const groups: TournamentQueueGroup[] = [];
  const cancelledEntries: typeof entries = [];
  let index = 0;

  while (index < entries.length) {
    const start = index;
    const minPower = entries[start]!.combatPower;
    index++;
    while (index < entries.length && index - start < maxPlayers) {
      if (relativeGap(minPower, entries[index]!.combatPower) > options.maxPowerGap) break;
      index++;
    }

    const chunk = entries.slice(start, index);
    if (chunk.length < 2) {
      cancelledEntries.push(...chunk);
      continue;
    }
    groups.push({
      sourceQueueIds: [...new Set(chunk.map(entry => entry.queueId))],
      participants: chunk.map(({ queueId: _queueId, ...participant }) => participant),
    });
  }

  return {
    groups,
    cancelledParticipants: cancelledEntries.map(({ queueId: _queueId, ...participant }) => participant),
    cancelledQueueIds: [...new Set(cancelledEntries.map(entry => entry.queueId))],
  };
}
