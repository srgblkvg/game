export interface DivisionQueueParticipant {
  userId: number;
  division: number;
  combatPower: number;
}

export interface DivisionParticipantGroup {
  division: number;
  participants: DivisionQueueParticipant[];
}

export interface DivisionQueueSplit {
  divisions: DivisionParticipantGroup[];
  singletons: DivisionQueueParticipant[];
}

export interface DivisionPrizeAllocation {
  divisionPools: Array<{ division: number; prizePool: number }>;
  refund: number;
}

const MAX_GROUP_POWER_GAP = 0.15;

function isCompatible(participants: DivisionQueueParticipant[]): boolean {
  const powers = participants.map(participant => participant.combatPower);
  const minPower = Math.min(...powers);
  const maxPower = Math.max(...powers);
  return maxPower <= 0 || (maxPower - minPower) / maxPower <= MAX_GROUP_POWER_GAP;
}

function groupCompatibleSingletons(
  sorted: DivisionQueueParticipant[],
): { groups: DivisionParticipantGroup[]; waiting: DivisionQueueParticipant[] } {
  const groups: DivisionParticipantGroup[] = [];
  const waiting: DivisionQueueParticipant[] = [];
  let current: DivisionQueueParticipant[] = [];
  const flush = () => {
    if (current.length >= 2) groups.push({ division: current[0]!.division, participants: current });
    else waiting.push(...current);
    current = [];
  };
  for (const singleton of sorted) {
    if (current.length === 0 || isCompatible([...current, singleton])) current.push(singleton);
    else {
      flush();
      current = [singleton];
    }
  }
  flush();
  return { groups, waiting };
}

export function splitParticipantsByDivision(
  participants: DivisionQueueParticipant[],
): DivisionQueueSplit {
  const byDivision = new Map<number, DivisionQueueParticipant[]>();
  for (const participant of participants) {
    const list = byDivision.get(participant.division) || [];
    list.push(participant);
    byDivision.set(participant.division, list);
  }

  const divisions: DivisionParticipantGroup[] = [];
  const singletons: DivisionQueueParticipant[] = [];
  for (const division of [...byDivision.keys()].sort((a, b) => a - b)) {
    const entries = byDivision.get(division)!
      .slice()
      .sort((a, b) => a.userId - b.userId);
    if (entries.length === 1) singletons.push(entries[0]!);
    else divisions.push({ division, participants: entries });
  }
  // Сначала пытаемся присоединить одиночные дивизионы к совместимым группам.
  // Оставшиеся `singletons` возвращаются вызывающему коду для явной отмены
  // регистрации и уведомления игрока; автоматического переноса нет.
  if (singletons.length > 0) {
    const sorted = singletons.slice().sort((a, b) => a.combatPower - b.combatPower || a.userId - b.userId);
    if (divisions.length > 0) {
      // Одиночник присоединяется только к совместимой по БМ группе.
      for (const singleton of sorted) {
        let target: DivisionParticipantGroup | null = null;
        let targetDistance = Number.POSITIVE_INFINITY;
        for (const group of divisions) {
          if (!isCompatible([...group.participants, singleton])) continue;
          const groupPower = group.participants.reduce((sum, entry) => sum + entry.combatPower, 0) / group.participants.length;
          const distance = Math.abs(groupPower - singleton.combatPower);
          if (distance < targetDistance || (distance === targetDistance && group.division < (target?.division ?? Number.POSITIVE_INFINITY))) {
            target = group;
            targetDistance = distance;
          }
        }
        if (target) target.participants.push(singleton);
      }
      const movedIds = new Set(divisions.flatMap(group => group.participants.map(entry => entry.userId)));
      const remaining = sorted.filter(entry => !movedIds.has(entry.userId));
      const grouped = groupCompatibleSingletons(remaining);
      divisions.push(...grouped.groups);
      return { divisions, singletons: grouped.waiting };
    }
    if (sorted.length >= 2) {
      const grouped = groupCompatibleSingletons(sorted);
      divisions.push(...grouped.groups);
      return { divisions, singletons: grouped.waiting };
    }
  }
  return { divisions, singletons };
}

export function allocateDivisionPrizePools(
  totalReserve: number,
  split: DivisionQueueSplit,
  getWeight: (participant: DivisionQueueParticipant) => number,
): DivisionPrizeAllocation {
  const reserve = Math.max(0, Math.floor(totalReserve));
  const allParticipants = [
    ...split.divisions.flatMap(group => group.participants),
    ...split.singletons,
  ];
  const totalWeight = allParticipants.reduce(
    (sum, participant) => sum + Math.max(0, getWeight(participant)),
    0,
  );
  if (reserve === 0 || totalWeight === 0) return { divisionPools: [], refund: reserve };

  const divisionPools = split.divisions.map(group => {
    const weight = group.participants.reduce(
      (sum, participant) => sum + Math.max(0, getWeight(participant)),
      0,
    );
    return { division: group.division, prizePool: Math.floor(reserve * weight / totalWeight) };
  });
  const allocated = divisionPools.reduce((sum, row) => sum + row.prizePool, 0);
  return { divisionPools, refund: reserve - allocated };
}
