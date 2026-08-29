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
  // Level-дивизионы не смешиваются: БМ больше не участвует в подборе.
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
