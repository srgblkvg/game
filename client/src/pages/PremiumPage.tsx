import Card from '../components/ui/Card';
import BackButton from '../components/ui/BackButton';

export default function PremiumPage() {

    return (
        <div className="py-4 max-w-lg mx-auto">
            <BackButton />
            <Card>
                <h2 className="font-bold text-lg mb-3" style={{ color: '#f1c40f' }}>⭐ Премиум</h2>

                <div className="space-y-3 text-sm">
                    <div>
                        <h3 className="font-bold text-[var(--color-accent-gold)]" style={{ color: '#f1c40f' }}>Бонусы премиума:</h3>
                        <ul className="mt-1 space-y-1 ml-4 list-disc text-[var(--color-text-secondary)]">
                            <li><span style={{ color: '#f1c40f' }}>+30%</span> к доходу с охоты</li>
                            <li><span style={{ color: '#f1c40f' }}>+30%</span> к награде за работы</li>
                            <li>Кулдаун после боя <span style={{ color: '#f1c40f' }}>в 2 раза меньше</span> (2.5 мин вместо 5)</li>
                        </ul>
                    </div>

                    <div className="p-3 rounded bg-[var(--color-bg-input)] border border-[var(--color-border-light)]">
                        <p className="text-[var(--color-text-muted)] text-center">
                            Можно запросить у админа
                        </p>
                    </div>
                </div>
            </Card>
        </div>
    );
}
