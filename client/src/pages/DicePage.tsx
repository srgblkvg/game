import PageHeader from '../components/ui/PageHeader';
import BackButton from '../components/BackButton';
import DiceGame from '../components/DiceGame';

export default function DicePage() {
    return (
        <div className="max-w-lg mx-auto px-3 py-4">
            <PageHeader title="Кости" breadcrumbs={[{ label: 'Кости' }]} />
            <BackButton />
            <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4 border border-[var(--color-border-default)] mt-4">
                <DiceGame />
            </div>
        </div>
    );
}
