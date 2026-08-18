export interface CompletedTournamentParticipantRow {
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
      username: participant.username,
      guildName: participant.guildName ?? null,
      guildId: participant.guildId ?? null,
    } as CompletedTournamentPrizePresenter];
  }).sort((left, right) => left.place - right.place);
  const seenPlaces = new Set<number>();
  return presented.filter(entry => {
    if (seenPlaces.has(entry.place)) return false;
    seenPlaces.add(entry.place);
    return true;
  });
}
