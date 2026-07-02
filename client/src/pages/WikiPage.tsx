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
            <p className="text-sm text-[var(--color-text-secondary)] mb-2">Вы попадаете на главную страницу с <strong>карточкой персонажа</strong>. У вас есть ник, уровень, опыт и четыре базовые характеристики: <strong>Сила</strong> (урон), <strong>Ловкость</strong> (уклонение), <strong>Защита</strong> (блок, кап 75%) и <strong>Мастерство</strong> (крит). HP = Сила + Ловкость + Мастерство.</p>
            <p className="text-sm text-[var(--color-text-secondary)] mb-2">Введите никнейм на странице входа — и вы в игре. Чтобы сохранить прогресс, <strong>привяжите почту или OAuth</strong> через меню настроек (шестерёнка → Аккаунт). За привязку — <strong>3 дня премиума</strong>!</p>

            <h2 className="text-lg font-bold text-[var(--color-accent-danger)] mt-6 mb-2 pb-1 border-b border-[var(--color-border-light)]">🏠 Домашняя страница</h2>
            <h3 className="text-sm font-bold text-[var(--color-accent-success)] mt-3 mb-1">Карточка персонажа</h3>
            <p className="text-sm text-[var(--color-text-muted)]">Показывает ник, уровень, гильдию, здоровье и снаряжение (10 слотов). Клик по пустому слоту — экипировать предмет. Клик по занятому — снять. Наведите на предмет — увидите его статы.</p>

            <h3 className="text-sm font-bold text-[var(--color-accent-success)] mt-3 mb-1">🌍 МИР — PvE-активности</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 my-2">
                <Card className="p-2"><span className="text-lg">💀</span><h4 className="text-sm text-[var(--color-accent-success)]">Охота</h4><p className="text-[0.6rem] text-[var(--color-text-muted)]">PvE-бои с монстрами. 10 этажей по сложности: Легко → Ад.</p></Card>
                <Card className="p-2"><span className="text-lg">🎒</span><h4 className="text-sm text-[var(--color-accent-success)]">Работы</h4><p className="text-[0.6rem] text-[var(--color-text-muted)]">Экспедиции за серебром. 5 типов с разным доходом.</p></Card>
                <Card className="p-2"><span className="text-lg">⚔️</span><h4 className="text-sm text-[var(--color-accent-success)]">Арена</h4><p className="text-[0.6rem] text-[var(--color-text-muted)]">PvP-бои с игроками. Победитель: опыт + серебро, проигравший: опыт.</p></Card>
            </div>

            <h3 className="text-sm font-bold text-[var(--color-accent-success)] mt-3 mb-1">🏰 Площадь — город</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 my-2">
                {[
                    ['🛒','Магазин','Покупка случайного снаряжения'],
                    ['🏦','Банк','Хранилище серебра, переводы (2%)'],
                    ['🔨','Крафт','Создание предметов по рецептам, улучшение'],
                    ['🏷️','Аукцион','Торговля между игроками, до 5 лотов'],
                    ['🍺','Трактир','Лечение, комнаты, напитки с баффами, квесты'],
                    ['🏰','Гильдия','Объединения, чат, постройки, войны'],
                ].map(([emoji, title, desc]) => (
                    <Card key={title} className="p-2"><span className="text-lg">{emoji}</span><h4 className="text-sm text-[var(--color-accent-success)]">{title}</h4><p className="text-[0.6rem] text-[var(--color-text-muted)]">{desc}</p></Card>
                ))}
            </div>

            <h3 className="text-sm font-bold text-[var(--color-accent-success)] mt-3 mb-1">📋 Правая панель</h3>
            <Card className="p-3 mb-3">
                <p className="text-xs text-[var(--color-text-muted)]"><strong>📜 Квесты</strong> — ежедневные задания 5 типов (охота, арена, работы, крафт, аукцион) × 3 сложности (⭐/⭐⭐/⭐⭐⭐). До 5 квестов в день.</p>
                <p className="text-xs text-[var(--color-text-muted)]"><strong>🏆 Турниры</strong> — расписание турниров с призовым фондом.</p>
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
                <p className="text-xs text-[var(--color-text-muted)]"><strong>Базовые статы:</strong> Сила (урон), Ловкость (уклонение), Защита (блок, кап 75%), Мастерство (крит). HP = S+A+M.</p>
                <p className="text-xs text-[var(--color-text-muted)]"><strong>Extra-статы:</strong> крит, уклонение, контр-атака, полный блок. Даются амулетами, кольцами, поясами и щитами. Растут с уровнем предмета (×1.1 за уровень).</p>
                <p className="text-xs text-[var(--color-text-muted)]"><strong>PvE (Охота):</strong> выбор этажа → моб → бой. Кулдаун 300с (150с с премиумом). Опыт + серебро.</p>
                <p className="text-xs text-[var(--color-text-muted)]"><strong>PvP (Арена):</strong> поиск соперника → бой. Победитель: опыт + серебро, проигравший: опыт.</p>
            </Card>

            <h2 className="text-lg font-bold text-[var(--color-accent-danger)] mt-6 mb-2 pb-1 border-b border-[var(--color-border-light)]">🎒 Снаряжение и инвентарь</h2>
            <Card className="p-3 mb-3">
                <p className="text-xs text-[var(--color-text-muted)]"><strong>10 слотов:</strong> Оружие, Щит, Шлем, Нагрудник, Перчатки, Ботинки, Амулет, Пояс, Кольцо 1, Кольцо 2.</p>
                <p className="text-xs text-[var(--color-text-muted)]"><strong>Редкости:</strong> Хлам → Обычный → Необычный → Редкий → Эпический → Легендарный → Мифический.</p>
                <p className="text-xs text-[var(--color-text-muted)]"><strong>Инвентарь:</strong> 10 слотов по умолчанию. Нельзя надеть два одинаковых кольца.</p>
            </Card>

            <h2 className="text-lg font-bold text-[var(--color-accent-danger)] mt-6 mb-2 pb-1 border-b border-[var(--color-border-light)]">🔨 Крафт</h2>
            <Card className="p-3 mb-3">
                <p className="text-xs text-[var(--color-text-muted)]"><strong>Рецепты:</strong> создание предметов из материалов (добываются в Охоте и Работах).</p>
                <p className="text-xs text-[var(--color-text-muted)]"><strong>Улучшение:</strong> камень усиления + предмет → +1 уровень к предмету.</p>
            </Card>

            <h2 className="text-lg font-bold text-[var(--color-accent-danger)] mt-6 mb-2 pb-1 border-b border-[var(--color-border-light)]">📚 Коллекция</h2>
            <Card className="p-3 mb-3">
                <p className="text-xs text-[var(--color-text-muted)]">Собирайте предметы в коллекцию (удаляются из инвентаря). За полные сеты — бонус к характеристикам. Доступно через меню персонажа.</p>
            </Card>

            <h2 className="text-lg font-bold text-[var(--color-accent-danger)] mt-6 mb-2 pb-1 border-b border-[var(--color-border-light)]">🏰 Гильдии</h2>
            <p className="text-sm text-[var(--color-text-secondary)] mb-2">Вступите через список гильдий или примите приглашение (приходит в личные сообщения). 4 вкладки: Обзор, Постройки, Казна, Участники.</p>
            <Card className="p-3 mb-3">
                <p className="text-xs text-[var(--color-text-muted)]"><strong>Постройки:</strong> 4 типа — каждое улучшение даёт +5 к статам в своём контексте:</p>
                <p className="text-xs text-[var(--color-text-muted)] ml-2">🏟️ Тренировочная площадка — бонус на Арене и Турнирах</p>
                <p className="text-xs text-[var(--color-text-muted)] ml-2">🔭 Штаб разведки — бонус против монстров (PvE)</p>
                <p className="text-xs text-[var(--color-text-muted)] ml-2">⚔️ Осадный лагерь — бонус при атаке в войне гильдий</p>
                <p className="text-xs text-[var(--color-text-muted)] ml-2">🏰 Стены — бонус при защите в войне гильдий</p>
            </Card>

            <h2 className="text-lg font-bold text-[var(--color-accent-danger)] mt-6 mb-2 pb-1 border-b border-[var(--color-border-light)]">⭐ Премиум</h2>
            <Card className="p-3 mb-3">
                <p className="text-xs text-[var(--color-text-muted)]"><strong>Бонусы:</strong> кулдаун Охоты 150с вместо 300с, регенерация HP как в Чулане (×3) если нет активной комнаты.</p>
                <p className="text-xs text-[var(--color-text-muted)]"><strong>Получение:</strong> 3 дня за привязку аккаунта, покупка через магазин (VK Pay / ЮKassa).</p>
            </Card>

            <h2 className="text-lg font-bold text-[var(--color-accent-danger)] mt-6 mb-2 pb-1 border-b border-[var(--color-border-light)]">🍺 Трактир</h2>
            <Card className="p-3 mb-3">
                <p className="text-xs text-[var(--color-text-muted)]"><strong>Лечение:</strong> мгновенное восстановление HP за серебро (50% или 100% от недостающего).</p>
                <p className="text-xs text-[var(--color-text-muted)]"><strong>Комнаты:</strong> ускоренная регенерация HP на 1 или 8 часов:</p>
                <p className="text-xs text-[var(--color-text-muted)] ml-2">Чулан — ×3 (100💰/ч)</p>
                <p className="text-xs text-[var(--color-text-muted)] ml-2">Койка — ×10 (500💰/ч)</p>
                <p className="text-xs text-[var(--color-text-muted)] ml-2">Аппартаменты — ×50 (2000💰/ч)</p>
                <p className="text-xs text-[var(--color-text-muted)]"><strong>Напитки:</strong> временные баффы к статам на 1 час. Три уровня для каждого стата (+10/+25/+50) и универсальные (+5/+12/+30 ко всем).</p>
            </Card>

            <div className="mt-6 text-center">
                <button onClick={() => navigate('/')} className="text-sm text-[var(--color-accent-info)] hover:underline">← Вернуться в игру</button>
            </div>
        </div>
    );
}
