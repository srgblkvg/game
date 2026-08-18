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
  // Игроки из одиночных технических дивизионов не должны пропадать:
  // раньше они оставались в `singletons`, а mergeExpiredOfficialQueues
  // создавал турниры только из `divisions`. Поэтому часть регистраций
  // завершалась возвратом фонда без участия в турнире.
  if (singletons.length > 0) {
    const sorted = singletons.slice().sort((a, b) => a.combatPower - b.combatPower || a.userId - b.userId);
    if (divisions.length > 0) {
      // Даже один игрок из редкого дивизиона присоединяется к ближайшей
      // группе. Одиночная регистрация не является причиной отмены участия.
      for (const singleton of sorted) {
        let target = divisions[0]!;
        let targetDistance = Number.POSITIVE_INFINITY;
        for (const group of divisions) {
          const groupPower = group.participants.reduce((sum, entry) => sum + entry.combatPower, 0) / group.participants.length;
          const distance = Math.abs(groupPower - singleton.combatPower);
          if (distance < targetDistance || (distance === targetDistance && group.division < target.division)) {
            target = group;
            targetDistance = distance;
          }
        }
        target.participants.push(singleton);
      }
      return { divisions, singletons: [] };
    }
    if (sorted.length >= 2) {
      divisions.push({ division: sorted[0]!.division, participants: sorted });
      return { divisions, singletons: [] };
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
