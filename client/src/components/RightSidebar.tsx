import TournamentBanner from './TournamentBanner';
import RatingBlock from './RatingBlock';

export default function RightSidebar() {
    return (
        <div className="flex flex-col gap-4 min-w-0 overflow-hidden w-full sm:w-auto">
            <TournamentBanner />
            <RatingBlock />
        </div>
    );
}
