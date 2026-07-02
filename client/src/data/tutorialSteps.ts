export interface TutorialStep {
  /** CSS-селектор элемента, который нужно подсветить */
  targetSelector: string;
  /** Заголовок шага */
  title: string;
  /** Описание */
  description: string;
  /** Где показывать подсказку относительно элемента: top, bottom, left, right, center */
  tooltipPosition?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

const tutorialSteps: TutorialStep[] = [
  {
    targetSelector: '#site-header',
    title: 'Шапка',
    description: 'Здесь отображается ваше серебро, статус защиты, игровое время и настройки. Кнопка «Сводка» покажет историю боёв и личные сообщения.',
    tooltipPosition: 'bottom',
  },
  {
    targetSelector: '[data-tutorial="character-card"]',
    title: 'Ваш персонаж',
    description: 'Карточка персонажа: имя, уровень, здоровье, опыт и экипировка. Нажмите на слот, чтобы надеть предмет из инвентаря.',
    tooltipPosition: 'right',
  },
  {
    targetSelector: '[data-tutorial="stat-allocation"]',
    title: 'Характеристики',
    description: 'Распределяйте очки по 4 характеристикам: Сила, Ловкость, Защита и Мастерство. Каждая влияет на урон, здоровье и шанс блока.',
    tooltipPosition: 'right',
  },
  {
    targetSelector: '[data-tutorial="inventory"]',
    title: 'Инвентарь',
    description: 'Все ваши предметы. Нажмите на предмет, затем на слот персонажа, чтобы экипировать. Предметы можно продать или использовать.',
    tooltipPosition: 'right',
  },
  {
    targetSelector: '[data-tutorial="actions"]',
    title: 'Действия',
    description: 'Основные активности: Арена (PvP-бои), Охота (PvE), Банк, Магазин, Ремесло, Работы, Гильдия и многое другое.',
    tooltipPosition: 'left',
  },
  {
    targetSelector: '[data-tutorial="right-sidebar"]',
    title: 'Боевой журнал',
    description: 'Турниры, рейтинг игроков и ежедневные задания. Нажмите на свёрток, чтобы открыть панель.',
    tooltipPosition: 'left',
  },
  {
    targetSelector: '[data-tutorial="chat-panel"]',
    title: 'Чат',
    description: 'Общайтесь с другими игроками! Вкладки: Общий чат, Гильдия, Аукцион и личные сообщения. Чат можно свернуть кнопкой в углу.',
    tooltipPosition: 'top',
  },
];

export default tutorialSteps;
