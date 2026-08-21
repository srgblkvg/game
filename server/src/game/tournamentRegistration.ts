export interface TournamentRegistrationWindow {
  registrationStart: number;
  registrationEnd: number;
}

/** Registration is open from registrationStart (inclusive) to registrationEnd (exclusive). */
export function isTournamentRegistrationOpen(
  tournament: TournamentRegistrationWindow,
  now: number,
): boolean {
  return Number(tournament.registrationStart) <= now
    && Number(tournament.registrationEnd) > now;
}
