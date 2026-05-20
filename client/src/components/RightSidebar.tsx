import RatingBlock from './RatingBlock';

export default function RightSidebar() {
    return (
        <div className="right-sidebar" style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            minWidth: 0,
            overflow: 'hidden',
        }}>
            <RatingBlock />
            {/* здесь позже можно добавлять другие блоки */}
        </div>
    );
}