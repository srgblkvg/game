export interface CompletedTournamentParticipantRow {
  userId?: number;
  username: string;
  guildName?: string | null;
  guildId?: number | null;
  snapshotStats: unknown;
  [key: string]: unknown;
}

export interface CompletedTournamentPrizePresenter {
  place: 1 | 2 | 3;
  username: string;
  guildName: string | null;
  guildId: number | null;
  [key: string]: unknown;
}

function parseSnapshot(raw: unknown): Record<string, unknown> | null {
  try {
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function resultFrom(snapshot: Record<string, unknown>): Record<string, unknown> | null {
  const result = snapshot.result;
  return result !== null && typeof result === 'object' && !Array.isArray(result)
    ? result as Record<string, unknown>
    : null;
}

function snapshotPlayerName(snapshot: Record<string, unknown>): string | null {
  const player = snapshot.player;
  if (!player || typeof player !== 'object' || Array.isArray(player)) return null;
  const name = (player as Record<string, unknown>).name;
  return typeof name === 'string' && name.trim() ? name : null;
}

export function completedTournamentParticipantName(
  participant: CompletedTournamentParticipantRow,
): string {
  if (participant.username?.trim()) return participant.username;
  const snapshot = parseSnapshot(participant.snapshotStats);
  return (snapshot && snapshotPlayerName(snapshot)) || 'Игрок удалён';
}

/** Presents persisted podium results for a completed tournament. */
export function presentCompletedTournamentTop3(
  participants: CompletedTournamentParticipantRow[],
): CompletedTournamentPrizePresenter[] {
  const presented = participants.flatMap(participant => {
    const snapshot = parseSnapshot(participant.snapshotStats);
    if (!snapshot) return [];

    const nestedResult = resultFrom(snapshot);
    const rawPlace = nestedResult?.place ?? snapshot.place;
    if (rawPlace !== 1 && rawPlace !== 2 && rawPlace !== 3) return [];

    const prize = nestedResult?.prize ?? snapshot.prize;
    return [{
      ...snapshot,
      place: rawPlace,
      ...(prize === undefined ? {} : { prize }),
      username: completedTournamentParticipantName(participant),
      ...(participant.userId === undefined ? {} : { _participantUserId: participant.userId }),
      guildName: participant.guildName ?? null,
      guildId: participant.guildId ?? null,
    } as CompletedTournamentPrizePresenter];
  }).sort((left, right) => left.place - right.place);
  const seenPlaces = new Set<number>();
  const seenUsers = new Set<number>();
  return presented.filter(entry => {
    if (seenPlaces.has(entry.place)) return false;
    const userId = entry._participantUserId;
    if (typeof userId === 'number' && seenUsers.has(userId)) return false;
    seenPlaces.add(entry.place);
    if (typeof userId === 'number') seenUsers.add(userId);
    return true;
  }).map(entry => {
    const { _participantUserId: _ignored, ...publicEntry } = entry;
    return publicEntry as CompletedTournamentPrizePresenter;
  });
}
