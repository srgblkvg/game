import TournamentBanner from './TournamentBanner';
import RatingBlock from './RatingBlock';
import QuestsBlock from './QuestsBlock';

export default function RightSidebar() {
    const handleHighlight = (type: string | null) => {
        if (type) {
            window.location.hash = `action-${type}`;
        } else {
            window.location.hash = '';
        }
    };

    return (
        <div className="flex flex-col gap-4 min-w-0 overflow-hidden w-full sm:w-auto">
            <QuestsBlock onHighlight={handleHighlight} />
            <TournamentBanner />
            <RatingBlock />
        </div>
    );
}
