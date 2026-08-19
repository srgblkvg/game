export type TournamentCallToAction = 'loading' | 'countdown' | 'joinable';

interface TournamentCallToActionState {
    loaded: boolean;
    tournament: { status?: string } | null;
    nextSeconds: number;
}

export function getTournamentCallToAction(state: TournamentCallToActionState): TournamentCallToAction {
    if (!state.loaded) return 'loading';
    if (!state.tournament && state.nextSeconds > 0) return 'countdown';
    return 'joinable';
}
