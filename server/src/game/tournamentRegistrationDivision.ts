import { getEligibleTournamentDivisions } from './tournamentDivision';
export interface RegistrationDivisionSnapshot {
  divisionIndex?: number;
  divisionBasis?: 'level';
  player: { level: number };
}

export function getRegistrationDivisionIndex(snapshot: RegistrationDivisionSnapshot): number {
  if (snapshot.divisionBasis === 'level' && snapshot.divisionIndex != null) {
    return snapshot.divisionIndex;
  }
  const eligible = getEligibleTournamentDivisions(snapshot.player.level);
  return eligible[eligible.length - 1]?.index ?? 0;
}

export function getRegistrationIdentity(userId: number, divisionIndex: number): string {
  return `${userId}:${divisionIndex}`;
}
