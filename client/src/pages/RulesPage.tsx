import { useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card';

export default function RulesPage() {
    const navigate = useNavigate();

    return (
        <div className="max-w-2xl mx-auto px-4 py-6">
            <button onClick={() => navigate(-1)} className="text-sm text-[var(--color-accent-info)] hover:underline mb-4 inline-block">← Назад</button>

            <h1 className="text-xl font-bold text-center mb-1">📜 Правила игры</h1>
            <p className="text-center text-[var(--color-text-muted)] text-sm mb-5">MMO Arena — честная игра для всех</p>

            <Card className="p-4 space-y-4">
                <div>
                    <h3 className="font-bold text-sm text-[var(--color-accent-success)] mb-1">🤝 Честная игра</h3>
                    <p className="text-sm text-[var(--color-text-secondary)]">Мы за честную игру. Запрещены любые формы мошенничества, обмана других игроков, использование сторонних программ, ботов и скриптов для получения преимущества.</p>
                </div>

                <div>
                    <h3 className="font-bold text-sm text-[var(--color-accent-success)] mb-1">🐛 Баги и уязвимости</h3>
                    <p className="text-sm text-[var(--color-text-secondary)]">При обнаружении багов или уязвимостей запрещено использовать их для получения преимущества. Сообщите о находке в поддержку — мы ценим помощь в улучшении игры.</p>
                </div>

                <div>
                    <h3 className="font-bold text-sm text-[var(--color-accent-success)] mb-1">👤 Один аккаунт</h3>
                    <p className="text-sm text-[var(--color-text-secondary)]">Игрок заявляет, что это его единственный аккаунт. Мультиаккаунтинг запрещён — создание нескольких учётных записей для обхода ограничений или получения преимущества.</p>
                </div>

                <div>
                    <h3 className="font-bold text-sm text-[var(--color-accent-danger)] mb-1">🚫 Последствия</h3>
                    <p className="text-sm text-[var(--color-text-secondary)]">В случае нарушения правил администрация оставляет за собой право заблокировать или удалить аккаунт без предупреждения и возврата средств.</p>
                </div>

                <div className="border-t border-[var(--color-border-light)] pt-3">
                    <p className="text-xs text-[var(--color-text-muted)]">Нажимая «В бой» при входе в игру, вы подтверждаете согласие с данными правилами.</p>
                </div>
            </Card>
        </div>
    );
}
