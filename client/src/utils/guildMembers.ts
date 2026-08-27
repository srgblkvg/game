export type GuildMember = {
    userId: number;
    rank: string;
    level?: number | null;
    [key: string]: unknown;
};

export function sortGuildMembers<T extends GuildMember>(members: readonly T[]): T[] {
    const rankOrder = (rank: string) => rank === 'leader' ? 0 : rank === 'officer' ? 1 : 2;

    return [...members].sort((a, b) => {
        const rankDifference = rankOrder(a.rank) - rankOrder(b.rank);
        if (rankDifference !== 0) return rankDifference;
        return (b.level || 0) - (a.level || 0);
    });
}
