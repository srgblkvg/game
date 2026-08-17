export const OFFICIAL_CYCLE_INTERVAL = 8 * 60 * 60;
export const OFFICIAL_REGISTRATION_DURATION = 15 * 60;

export interface OfficialCycleStateInput {
  now: number;
  lastCompletedAt?: number | null;
  hasInProgressTournament?: boolean;
}

export interface OfficialCycleState {
  registrationOpen: boolean;
  registrationOpensAt: number | null;
}

export function getOfficialCycleState(input: OfficialCycleStateInput): OfficialCycleState {
  if (input.hasInProgressTournament) {
    return { registrationOpen: false, registrationOpensAt: null };
  }
  const lastCompletedAt = Number(input.lastCompletedAt || 0);
  if (lastCompletedAt > 0) {
    const registrationOpensAt = lastCompletedAt + OFFICIAL_CYCLE_INTERVAL;
    if (input.now < registrationOpensAt) {
      return { registrationOpen: false, registrationOpensAt };
    }
  }
  return { registrationOpen: true, registrationOpensAt: null };
}

export interface ActiveOfficialQueueWindow {
  registrationStart: number;
  registrationEnd: number;
}

export function getRegistrationWindowForNewQueue(input: {
  now: number;
  activeQueues: ActiveOfficialQueueWindow[];
}): ActiveOfficialQueueWindow | null {
  if (input.activeQueues.length === 0) {
    return {
      registrationStart: input.now,
      registrationEnd: input.now + OFFICIAL_REGISTRATION_DURATION,
    };
  }
  const registrationStart = Math.min(...input.activeQueues.map(queue => queue.registrationStart));
  const registrationEnd = Math.min(...input.activeQueues.map(queue => queue.registrationEnd));
  if (input.now >= registrationEnd) return null;
  return { registrationStart, registrationEnd };
}

export function getLonelyQueueDisposition(input: {
  now: number;
  participantCount: number;
}): { cancelCurrentQueue: boolean; nextRegistrationOpensAt: number | null } {
  if (input.participantCount !== 1) {
    return { cancelCurrentQueue: false, nextRegistrationOpensAt: null };
  }
  return {
    cancelCurrentQueue: true,
    nextRegistrationOpensAt: input.now + OFFICIAL_CYCLE_INTERVAL,
  };
}
