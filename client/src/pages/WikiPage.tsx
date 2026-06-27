import { useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card';

export default function WikiPage() {
    const navigate = useNavigate();

    return (
        <div className="max-w-3xl mx-auto px-4 py-6">
            <button onClick={() => navigate('/')} className="text-sm text-[var(--color-accent-info)] hover:underline mb-4 inline-block">← Вернуться в игру</button>

            <h1 className="text-2xl font-bold text-center text-[var(--color-accent-danger)] mb-1">⚔️ MMO Arena</h1>
            <p className="text-center text-[var(--color-text-muted)] text-sm mb-6">Гайд для нового игрока</p>

            <Card className="mb-4 border-l-4 border-l-[var(--color-accent-success)] bg-[var(--color-accent-success)]/5 p-3">
                <p className="text-sm"><span className="text-[var(--color-accent-success)] font-bold">💡 Совет:</span> Начните с Охоты — безопасный способ получить первый опыт и серебро. Затем купите снаряжение в Магазине и выполняйте квесты.</p>
            </Card>

            <h2 className="text-lg font-bold text-[var(--color-accent-danger)] mt-6 mb-2 pb-1 border-b border-[var(--color-border-light)]">🚀 Начало игры</h2>
            <p className="text-sm text-[var(--color-text-secondary)] mb-2">Вы попадаете на главную страницу с <strong>карточкой персонажа</strong>. У вас есть ник, уровень, опыт и четыре базовые характеристики: <strong>Сила</strong>, <strong>Ловкость</strong>, <strong>Защита</strong> и <strong>Мастерство</strong>.</p>
            <p className="text-sm text-[var(--color-text-secondary)] mb-2">Просто введите никнейм на странице входа — и вы в игре. Чтобы сохранить прогресс, <strong>привяжите почту или OAuth</strong> через меню настроек (шестерёнка → Аккаунт). За привязку — 3 дня премиума!</p>

            <h2 className="text-lg font-bold text-[var(--color-accent-danger)] mt-6 mb-2 pb-1 border-b border-[var(--color-border-light)]">🏠 Домашняя страница</h2>
            <h3 className="text-sm font-bold text-[var(--color-accent-success)] mt-3 mb-1">Карточка персонажа</h3>
            <p className="text-sm text-[var(--color-text-muted)]">Показывает ник, уровень, гильдию, здоровье и снаряжение. Клик по слоту — экипировать предмет. Наведите на предмет — увидите его статы.</p>

            <h3 className="text-sm font-bold text-[var(--color-accent-success)] mt-3 mb-1">🌍 МИР — PvE-активности</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 my-2">
                <Card className="p-2"><span className="text-lg">💀</span><h4 className="text-sm text-[var(--color-accent-success)]">Охота</h4><p className="text-[0.6rem] text-[var(--color-text-muted)]">PvE-бои с монстрами. Этажи по сложности: Легко → Ад.</p></Card>
                <Card className="p-2"><span className="text-lg">🎒</span><h4 className="text-sm text-[var(--color-accent-success)]">Работы</h4><p className="text-[0.6rem] text-[var(--color-text-muted)]">Экспедиции за серебром. Доход зависит от типа.</p></Card>
                <Card className="p-2"><span className="text-lg">⚔️</span><h4 className="text-sm text-[var(--color-accent-success)]">Арена</h4><p className="text-[0.6rem] text-[var(--color-text-muted)]">PvP-бои с игроками. Опыт + серебро.</p></Card>
            </div>

            <h3 className="text-sm font-bold text-[var(--color-accent-success)] mt-3 mb-1">🏰 Площадь — город</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 my-2">
                {[
                    ['🛒','Магазин','Покупка случайного снаряжения'],
                    ['🏦','Банк','Хранилище серебра, переводы (2%)'],
                    ['🔨','Крафт','Улучшение предметов, 3→1'],
                    ['🏷️','Аукцион','Торговля между игроками, 5 лотов'],
                    ['🍺','Трактир','Лечение, напитки с баффами, квесты'],
                    ['🏰','Гильдия','Объединения, чат, постройки, войны'],
                ].map(([emoji, title, desc]) => (
                    <Card key={title} className="p-2"><span className="text-lg">{emoji}</span><h4 className="text-sm text-[var(--color-accent-success)]">{title}</h4><p className="text-[0.6rem] text-[var(--color-text-muted)]">{desc}</p></Card>
                ))}
            </div>

            <h3 className="text-sm font-bold text-[var(--color-accent-success)] mt-3 mb-1">📋 Правая панель</h3>
            <Card className="p-3 mb-3">
                <p className="text-xs text-[var(--color-text-muted)]"><strong>📜 Квесты</strong> — ежедневные задания 5 типов × 3 сложности. До 3 активных, до 5 в день.</p>
                <p className="text-xs text-[var(--color-text-muted)]"><strong>🏆 Турниры</strong> — расписание с призовым фондом.</p>
                <p className="text-xs text-[var(--color-text-muted)]"><strong>📊 Рейтинг</strong> — топ игроков.</p>
            </Card>

            <h2 className="text-lg font-bold text-[var(--color-accent-danger)] mt-6 mb-2 pb-1 border-b border-[var(--color-border-light)]">💬 Чат</h2>
            <p className="text-sm text-[var(--color-text-secondary)] mb-2">Панель чата внизу экрана. Клик — развернуть.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                <Card className="p-2"><h4 className="text-sm text-[var(--color-accent-success)]">🌍 Общий</h4><p className="text-[0.6rem] text-[var(--color-text-muted)]">Публичный чат</p></Card>
                <Card className="p-2"><h4 className="text-sm text-[var(--color-accent-success)]">🏚️ Гильдия</h4><p className="text-[0.6rem] text-[var(--color-text-muted)]">Чат гильдии</p></Card>
                <Card className="p-2"><h4 className="text-sm text-[var(--color-accent-success)]">✉️ ЛС</h4><p className="text-[0.6rem] text-[var(--color-text-muted)]">Приватные сообщения</p></Card>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mb-1">Команды: <code className="bg-[var(--color-bg-input)] px-1 rounded text-[var(--color-accent-gold)]">@ник</code> упоминание, <code className="bg-[var(--color-bg-input)] px-1 rounded text-[var(--color-accent-gold)]">/w ник</code> личное сообщение, <code className="bg-[var(--color-bg-input)] px-1 rounded text-[var(--color-accent-gold)]">/g</code> в гильдию.</p>

            <h2 className="text-lg font-bold text-[var(--color-accent-danger)] mt-6 mb-2 pb-1 border-b border-[var(--color-border-light)]">⚔️ Боевая система</h2>
            <Card className="p-3 mb-3">
                <p className="text-xs text-[var(--color-text-muted)]"><strong>Характеристики:</strong> Сила (урон), Ловкость (уклонение), Защита (блок), Мастерство (крит). HP = S+A+M.</p>
                <p className="text-xs text-[var(--color-text-muted)]"><strong>Extra-статы:</strong> крит, уклон, контр-атака, полный блок. Даются амулетами, кольцами, поясами.</p>
                <p className="text-xs text-[var(--color-text-muted)]"><strong>PvE:</strong> выбор этажа → моб → бой. Кулдаун. Опыт + серебро.</p>
                <p className="text-xs text-[var(--color-text-muted)]"><strong>PvP:</strong> поиск → бой. Победитель: опыт + серебро, проигравший: опыт.</p>
            </Card>

            <h2 className="text-lg font-bold text-[var(--color-accent-danger)] mt-6 mb-2 pb-1 border-b border-[var(--color-border-light)]">📈 Развитие</h2>
            <Card className="p-3 mb-3">
                <p className="text-xs text-[var(--color-text-muted)]"><strong>Снаряжение:</strong> оружие, щит, шлем, броня, амулет, кольцо, пояс. 7 слотов.</p>
                <p className="text-xs text-[var(--color-text-muted)]"><strong>Улучшение:</strong> камень + предмет → +1 уровень. Extra-статы тоже растут (×1.1 за уровень).</p>
                <p className="text-xs text-[var(--color-text-muted)]"><strong>Гильд-постройки:</strong> бонус к статам в разных режимах (PvE/PvP/турниры).</p>
                <p className="text-xs text-[var(--color-text-muted)]"><strong>⭐ Премиум:</strong> +30% серебра, ускоренный кулдаун. Даётся за привязку аккаунта (3 дня).</p>
            </Card>

            <h2 className="text-lg font-bold text-[var(--color-accent-danger)] mt-6 mb-2 pb-1 border-b border-[var(--color-border-light)]">🏰 Гильдии</h2>
            <p className="text-sm text-[var(--color-text-secondary)] mb-2">Вступите через список гильдий или примите приглашение (приходит в личные сообщения). 4 вкладки: Обзор, Постройки, Казна, Участники.</p>

            <div className="mt-6 text-center">
                <button onClick={() => navigate('/')} className="text-sm text-[var(--color-accent-info)] hover:underline">← Вернуться в игру</button>
            </div>
        </div>
    );
}
