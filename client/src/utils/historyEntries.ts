export type HistoryEntryType = 'battle' | 'pve' | 'job' | 'tournament' | 'quest' | 'message' | 'massacre';

export type HistoryEntry = {
    id: string;
    type: HistoryEntryType;
    ts: number;
    data: any;
};

type HistorySources = {
    battles: any[];
    pveBattles: any[];
    jobHistory: any[];
    tournamentHistory: any[];
    questHistory: any[];
    privateMessages: any[];
    massacreBattles: any[];
};

export function toMs(value: any): number {
    return typeof value === 'number' ? value * 1000 : value ? new Date(value).getTime() : 0;
}

export function buildHistoryEntries({
    battles,
    pveBattles,
    jobHistory,
    tournamentHistory,
    questHistory,
    privateMessages,
    massacreBattles,
}: HistorySources): HistoryEntry[] {
    return [
        ...battles.map(data => ({ id: `b-${data.id}`, type: 'battle' as const, ts: new Date(data.createdAt).getTime(), data })),
        ...pveBattles.map(data => ({ id: `p-${data.id}`, type: 'pve' as const, ts: new Date(data.createdAt).getTime(), data })),
        ...jobHistory.map(data => ({ id: `j-${data.id}`, type: 'job' as const, ts: new Date(data.finishedAt).getTime(), data })),
        ...tournamentHistory.map(data => ({ id: `t-${data.id}`, type: 'tournament' as const, ts: toMs(data.completedAt || data.createdAt), data })),
        ...questHistory.map(data => ({ id: `q-${data.id}`, type: 'quest' as const, ts: new Date(data.createdAt).getTime(), data })),
        ...privateMessages.map(data => ({ id: `m-${data.id}`, type: 'message' as const, ts: new Date(data.createdAt).getTime(), data })),
        ...massacreBattles.map(data => ({ id: `mb-${data.id}`, type: 'massacre' as const, ts: toMs(data.gathering_end || data.created_at), data })),
    ].sort((a, b) => b.ts - a.ts);
}
