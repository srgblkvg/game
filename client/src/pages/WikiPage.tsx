import { useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card';

export default function WikiPage() {
    const navigate = useNavigate();

    return (
        <div className="max-w-3xl mx-auto px-4 py-6">
            <button onClick={() => navigate('/')} className="text-sm text-[var(--color-accent-info)] hover:underline mb-4 inline-block cursor-pointer">← Вернуться в игру</button>

            <h1 className="text-2xl font-bold text-center text-[var(--color-accent-danger)] mb-1">⚔️ MMO Arena</h1>
            <p className="text-center text-[var(--color-text-muted)] text-sm mb-6">Гайд для нового игрока</p>

            <Card className="mb-4 p-4 border border-[#f59e0b]/30 relative mt-3">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[var(--color-bg-secondary)] border border-[#f59e0b]/30 rounded-full w-7 h-7 flex items-center justify-center text-sm shadow-[0_0_6px_rgba(245,158,11,0.3)]">
                    💡
                </div>
                <p className="text-sm text-center"><span className="text-[#fbbf24] font-bold">Совет:</span> Начните с Охоты — безопасный способ получить первый опыт и серебро. Затем купите снаряжение в Магазине и выполняйте квесты.</p>
            </Card>

            <h2 className="text-lg font-bold text-[var(--color-accent-danger)] mt-6 mb-2 pb-1 border-b border-[var(--color-border-light)]">🚀 Начало игры</h2>
            <p className="text-sm text-[var(--color-text-secondary)] mb-2">Вы попадаете на главную страницу с <strong>карточкой персонажа</strong>. У вас есть ник, уровень, опыт и четыре базовые характеристики:</p>
            <p className="text-sm text-[var(--color-text-muted)] mb-2"><strong>Сила</strong> — урон, <strong>Ловкость</strong> — уклонение, <strong>Защита</strong> — блок (кап 75%), <strong>Мастерство</strong> — крит. HP = Сила + Ловкость + Мастерство.</p>
            <p className="text-sm text-[var(--color-text-secondary)] mb-2">Введите никнейм на странице входа — и вы в игре. Чтобы сохранить прогресс, <strong>привяжите почту или OAuth</strong> через меню настроек (Настройки → Аккаунт). За привязку — <strong>1 день премиума</strong>!</p>

            <h2 className="text-lg font-bold text-[var(--color-accent-danger)] mt-6 mb-2 pb-1 border-b border-[var(--color-border-light)]">🌍 МИР — PvE</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 my-2">
                <Card className="p-2">
                    <span className="text-lg">💀</span>
                    <h4 className="text-sm text-[var(--color-accent-success)]">Охота (Бестиарий)</h4>
                    <p className="text-[0.6rem] text-[var(--color-text-muted)]">PvE-бои с монстрами. 10 этажей по сложности. Кулдаун 300с (150с с премиумом). Опыт + серебро + дроп.</p>
                </Card>
                <Card className="p-2">
                    <span className="text-lg">🎒</span>
                    <h4 className="text-sm text-[var(--color-accent-success)]">Работы</h4>
                    <p className="text-[0.6rem] text-[var(--color-text-muted)]">Экспедиции за серебром. 5 типов с разным доходом и длительностью. Можно отправиться и заниматься другими делами.</p>
                </Card>
            </div>

            <h2 className="text-lg font-bold text-[var(--color-accent-danger)] mt-6 mb-2 pb-1 border-b border-[var(--color-border-light)]">⚔️ PvP</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 my-2">
                <Card className="p-2">
                    <span className="text-lg">⚔️</span>
                    <h4 className="text-sm text-[var(--color-accent-success)]">Арена</h4>
                    <p className="text-[0.6rem] text-[var(--color-text-muted)]">PvP-бои 1×1. Поиск соперника → бой. Победитель: опыт + серебро, проигравший: опыт.</p>
                </Card>
                <Card className="p-2">
                    <span className="text-lg">🏆</span>
                    <h4 className="text-sm text-[var(--color-accent-success)]">Турниры</h4>
                    <p className="text-[0.6rem] text-[var(--color-text-muted)]">Регулярные турниры с призовым фондом. Расписание и регистрация на странице турниров.</p>
                </Card>
                <Card className="p-2">
                    <span className="text-lg">🗡️</span>
                    <h4 className="text-sm text-[var(--color-accent-success)]">Резня</h4>
                    <p className="text-[0.6rem] text-[var(--color-text-muted)]">PvP-ивент: платный вход, все против всех. Игроки ходят по очереди, последний выживший забирает банк.</p>
                </Card>
            </div>

            <h2 className="text-lg font-bold text-[var(--color-accent-danger)] mt-6 mb-2 pb-1 border-b border-[var(--color-border-light)]">🏰 Площадь — город</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 my-2">
                {[
                    ['🛒','Магазин','Покупка случайного снаряжения за серебро.'],
                    ['🏦','Банк','Хранилище серебра, переводы игрокам (комиссия 2%).'],
                    ['🔨','Крафт','Создание предметов по рецептам из материалов. Улучшение: камень + предмет → +1 уровень.'],
                    ['🏷️','Аукцион','Торговля между игроками. До 5 лотов. Ставки, выкуп.'],
                    ['🍺','Трактир','Лечение HP (50% или 100%), комнаты отдыха, напитки с баффами, ежедневные квесты.'],
                    ['🏰','Гильдии','Поиск и вступление в гильдию. Создание своей (5 уровень, 5000💰).'],
                ].map(([emoji, title, desc]) => (
                    <Card key={title} className="p-2"><span className="text-lg">{emoji}</span><h4 className="text-sm text-[var(--color-accent-success)]">{title}</h4><p className="text-[0.6rem] text-[var(--color-text-muted)]">{desc}</p></Card>
                ))}
            </div>

            <h3 className="text-sm font-bold text-[var(--color-accent-success)] mt-3 mb-1">🍺 Трактир подробнее</h3>
            <Card className="p-3 mb-3">
                <p className="text-xs text-[var(--color-text-muted)]"><strong>Лечение:</strong> мгновенное восстановление HP за серебро (2💰 за 1 HP).</p>
                <p className="text-xs text-[var(--color-text-muted)]"><strong>Комнаты</strong> (1ч / 8ч) — ускоренная регенерация HP (базовая: 1 HP/10с):</p>
                <p className="text-xs text-[var(--color-text-muted)] ml-2">Чулан — ×3 (100/600💰)</p>
                <p className="text-xs text-[var(--color-text-muted)] ml-2">Койка — ×10 (500/3000💰)</p>
                <p className="text-xs text-[var(--color-text-muted)] ml-2">Аппартаменты — ×50 (2000/12000💰)</p>
                <p className="text-xs text-[var(--color-text-muted)]"><strong>Напитки</strong> (1 час) — баффы к статам. 3 уровня: +10/+25/+50. Универсальные: +5/+12/+30 ко всем статам.</p>
            </Card>

            <h2 className="text-lg font-bold text-[var(--color-accent-danger)] mt-6 mb-2 pb-1 border-b border-[var(--color-border-light)]">📋 Информация</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 my-2">
                {[
                    ['📜','Квесты','Ежедневные: 5 типов × 3 сложности. До 5 в день.'],
                    ['📊','Рейтинг','Топ игроков. Также есть рейтинг гильдий.'],
                    ['📖','История','Журнал всех ваших боёв: PvE и PvP.'],
                    ['📚','Коллекция','Собирайте предметы (удаляются из инвентаря). За полные сеты — бонус к статам.'],
                    ['🏰','Замок','Хаб: турниры, рейтинг игроков и гильдий.'],
                ].map(([emoji, title, desc]) => (
                    <Card key={title} className="p-2"><span className="text-lg">{emoji}</span><h4 className="text-sm text-[var(--color-accent-success)]">{title}</h4><p className="text-[0.6rem] text-[var(--color-text-muted)]">{desc}</p></Card>
                ))}
            </div>

            <h2 className="text-lg font-bold text-[var(--color-accent-danger)] mt-6 mb-2 pb-1 border-b border-[var(--color-border-light)]">🏰 Гильдии</h2>
            <p className="text-sm text-[var(--color-text-secondary)] mb-2">Вступите через список гильдий или примите приглашение (приходит в ЛС). У гильдии 4 вкладки: Обзор, Постройки, Казна, Участники.</p>
            <p className="text-sm text-[var(--color-text-muted)] mb-2"><strong>Гильд-квесты:</strong> общие задания для всех участников (PvE, PvP, крафт, пожертвования, работы).</p>
            <p className="text-sm text-[var(--color-text-muted)] mb-2"><strong>Война гильдий:</strong> сражения между гильдиями. Бонусы от построек: Осадный лагерь (атака) и Стены (защита).</p>
            <Card className="p-3 mb-3">
                <p className="text-xs text-[var(--color-text-muted)]"><strong>Постройки</strong> — каждое улучшение +5% к статам в своём контексте:</p>
                <p className="text-xs text-[var(--color-text-muted)] ml-2">🏟️ Тренировочная площадка — Арена и Турниры</p>
                <p className="text-xs text-[var(--color-text-muted)] ml-2">🔭 Штаб разведки — против монстров (PvE)</p>
                <p className="text-xs text-[var(--color-text-muted)] ml-2">⚔️ Осадный лагерь — атака в войне гильдий</p>
                <p className="text-xs text-[var(--color-text-muted)] ml-2">🏰 Стены — защита в войне гильдий</p>
            </Card>

            <h2 className="text-lg font-bold text-[var(--color-accent-danger)] mt-6 mb-2 pb-1 border-b border-[var(--color-border-light)]">💬 Общение</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 my-2">
                <Card className="p-2">
                    <span className="text-lg">💬</span>
                    <h4 className="text-sm text-[var(--color-accent-success)]">Чат</h4>
                    <p className="text-[0.6rem] text-[var(--color-text-muted)]">Общий / Гильдия / ЛС. Команды: /w ник, /g. Панель внизу экрана.</p>
                </Card>
                <Card className="p-2">
                    <span className="text-lg">📝</span>
                    <h4 className="text-sm text-[var(--color-accent-success)]">Форум</h4>
                    <p className="text-[0.6rem] text-[var(--color-text-muted)]">Обсуждения, объявления, голосования.</p>
                </Card>
            </div>

            <h2 className="text-lg font-bold text-[var(--color-accent-danger)] mt-6 mb-2 pb-1 border-b border-[var(--color-border-light)]">🎒 Снаряжение</h2>
            <Card className="p-3 mb-3">
                <p className="text-xs text-[var(--color-text-muted)]"><strong>10 слотов:</strong> Оружие, Щит, Шлем, Нагрудник, Перчатки, Ботинки, Амулет, Пояс, Кольцо 1, Кольцо 2.</p>
                <p className="text-xs text-[var(--color-text-muted)]"><strong>Редкости:</strong> Хлам → Обычный → Необычный → Редкий → Эпический → Легендарный → Мифический.</p>
                <p className="text-xs text-[var(--color-text-muted)]"><strong>Базовые статы:</strong> Сила, Ловкость, Защита, Мастерство — есть на всех предметах.</p>
                <p className="text-xs text-[var(--color-text-muted)]"><strong>Extra-статы:</strong> крит, уклонение, контр-атака, полный блок — на амулетах, кольцах, поясах и щитах.</p>
                <p className="text-xs text-[var(--color-text-muted)]"><strong>Инвентарь:</strong> 10 слотов по умолчанию. Нельзя надеть два одинаковых кольца.</p>
            </Card>

            <h2 className="text-lg font-bold text-[var(--color-accent-danger)] mt-6 mb-2 pb-1 border-b border-[var(--color-border-light)]">⭐ Премиум</h2>
            <Card className="p-3 mb-3">
                <p className="text-xs text-[var(--color-text-muted)]"><strong>Бонусы:</strong> кулдаун Охоты 150с (вместо 300с), регенерация HP ×3 (как Чулан) если нет активной комнаты.</p>
                <p className="text-xs text-[var(--color-text-muted)]"><strong>Получение:</strong> 1 день за привязку аккаунта, покупка через магазин (VK Pay / ЮKassa).</p>
            </Card>

            <h2 className="text-lg font-bold text-[var(--color-accent-danger)] mt-6 mb-2 pb-1 border-b border-[var(--color-border-light)]">🛠️ Прочее</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 my-2">
                <Card className="p-2">
                    <span className="text-lg">📨</span>
                    <h4 className="text-sm text-[var(--color-accent-success)]">Обратная связь</h4>
                    <p className="text-[0.6rem] text-[var(--color-text-muted)]">Сообщить об ошибке или предложить идею.</p>
                </Card>
                <Card className="p-2">
                    <span className="text-lg">👤</span>
                    <h4 className="text-sm text-[var(--color-accent-success)]">Профиль</h4>
                    <p className="text-[0.6rem] text-[var(--color-text-muted)]">Просмотр профиля любого игрока: статы, снаряжение, гильдия.</p>
                </Card>
            </div>

            <div className="mt-6 text-center">
                <button onClick={() => navigate('/')} className="text-sm text-[var(--color-accent-info)] hover:underline cursor-pointer">← Вернуться в игру</button>
            </div>
        </div>
    );
}
