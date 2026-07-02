export interface TutorialStep {
  /** CSS-селектор элемента, который нужно подсветить */
  targetSelector: string;
  /** Заголовок шага */
  title: string;
  /** Описание */
  description: string;
  /** Где показывать подсказку относительно элемента: top, bottom, left, right, center */
  tooltipPosition?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  /** Кастомное событие перед показом шага (dispatchEvent) */
  action?: string;
}

const tutorialSteps: TutorialStep[] = [
  // --- 1. Шапка ---
  {
    targetSelector: '#site-header',
    title: 'Шапка',
    description: 'Здесь отображается ваше серебро, статус защиты, игровое время и настройки. Кнопка «Сводка» покажет историю боёв и личные сообщения.',
    tooltipPosition: 'bottom',
  },
  // --- 2. Персонаж ---
  {
    targetSelector: '[data-tutorial="character-card"]',
    title: 'Ваш персонаж',
    description: 'Карточка персонажа: имя, уровень, здоровье, опыт и экипировка. Нажмите на слот, чтобы надеть предмет из инвентаря.',
    tooltipPosition: 'right',
  },
  // --- 3. Характеристики (разворачиваем блок) ---
  {
    targetSelector: '[data-tutorial="stat-allocation"]',
    title: 'Характеристики',
    description: 'При достижении нового уровня вы получаете очки характеристик. Распределяйте их между Силой, Ловкостью, Защитой и Мастерством.',
    tooltipPosition: 'right',
    action: 'tutorial-expand-stats',
  },
  // --- 4. Сила ---
  {
    targetSelector: '[data-tutorial-stat="s"]',
    title: 'Сила',
    description: 'Увеличивает урон в атаке. Каждое очко делает ваши удары сильнее.',
    tooltipPosition: 'right',
  },
  // --- 5. Ловкость ---
  {
    targetSelector: '[data-tutorial-stat="a"]',
    title: 'Ловкость',
    description: 'Повышает уклонение и определяет очерёдность хода в бою. Быстрые персонажи атакуют первыми.',
    tooltipPosition: 'right',
  },
  // --- 6. Защита ---
  {
    targetSelector: '[data-tutorial-stat="d"]',
    title: 'Защита',
    description: 'Увеличивает шанс и силу блока. Заблокированный удар наносит меньше урона.',
    tooltipPosition: 'right',
  },
  // --- 7. Мастерство ---
  {
    targetSelector: '[data-tutorial-stat="m"]',
    title: 'Мастерство',
    description: 'Влияет на шанс критического удара, контратаки и оглушения противника.',
    tooltipPosition: 'right',
  },
  // --- 8. Усиления (разворачиваем блок) ---
  {
    targetSelector: '[data-tutorial="buffs-block"]',
    title: 'Усиления',
    description: 'Временные баффы: комната в Трактире (ускоряет регенерацию HP), напитки (боевые бонусы), премиум (сокращает кулдауны). Постоянные: коллекции предметов дают бонус к статам.',
    tooltipPosition: 'right',
    action: 'tutorial-expand-buffs',
  },
  // --- 9. Инвентарь ---
  {
    targetSelector: '[data-tutorial="inventory"]',
    title: 'Инвентарь',
    description: 'Все ваши предметы и ресурсы. Нажмите на предмет, затем на слот персонажа, чтобы экипировать. Предметы можно продать, использовать или скрафтить.',
    tooltipPosition: 'right',
  },
  // --- 10. Действия — обзор ---
  {
    targetSelector: '[data-tutorial="actions"]',
    title: 'Действия',
    description: 'Здесь собраны все основные активности. Пройдёмся по каждой.',
    tooltipPosition: 'left',
  },
  // --- 11. Арена (PvP) ---
  {
    targetSelector: '#action-card-Арена',
    title: 'Арена (PvP)',
    description: 'Бой с другим игроком. Победитель забирает процент серебра, которое противник носит с собой. Храните сбережения в Банке!',
    tooltipPosition: 'bottom',
  },
  // --- 12. Охота (PvE) ---
  {
    targetSelector: '#action-card-Охота',
    title: 'Охота (PvE)',
    description: 'Сражение с монстрами. С них выпадают ресурсы (камень, кожа, ткань) и предметы экипировки. Основной источник добычи.',
    tooltipPosition: 'bottom',
  },
  // --- 13. Банк ---
  {
    targetSelector: '#action-card-Банк',
    title: 'Банк',
    description: 'Храните серебро в безопасности. Деньги в банке нельзя потерять при поражении на Арене. Можно класть и снимать в любое время.',
    tooltipPosition: 'top',
  },
  // --- 14. Магазин ---
  {
    targetSelector: '#action-card-Магазин',
    title: 'Магазин',
    description: 'Покупайте предметы и расходники за серебро. Ассортимент обновляется.',
    tooltipPosition: 'top',
  },
  // --- 15. Ремесло ---
  {
    targetSelector: '#action-card-Ремесло',
    title: 'Ремесло',
    description: 'Создавайте и улучшайте предметы из добытых ресурсов. Собранные коллекции дают постоянные бонусы к характеристикам.',
    tooltipPosition: 'top',
  },
  // --- 16. Работы ---
  {
    targetSelector: '#action-card-Работы',
    title: 'Работы',
    description: 'Отправьте персонажа на работу — через время он вернётся с серебром и опытом. Работает даже когда вы не в игре.',
    tooltipPosition: 'top',
  },
  // --- 17. Гильдия ---
  {
    targetSelector: '#action-card-Гильдия',
    title: 'Гильдия',
    description: 'Вступайте в гильдии, участвуйте в войнах, выполняйте квесты и получайте бонусы от зданий гильдии.',
    tooltipPosition: 'top',
  },
  // --- 18. Аукцион ---
  {
    targetSelector: '#action-card-Аукцион',
    title: 'Аукцион',
    description: 'Выставляйте предметы на продажу другим игрокам или покупайте нужное. Ставки делаются серебром.',
    tooltipPosition: 'top',
  },
  // --- 19. Резня ---
  {
    targetSelector: '#action-card-Резня',
    title: 'Резня',
    description: 'Хаотичный PvP-режим — все против всех. Участвуйте, когда событие активно.',
    tooltipPosition: 'top',
  },
  // --- 20. Трактир ---
  {
    targetSelector: '#action-card-Трактир',
    title: 'Трактир',
    description: 'Снимите комнату для ускоренной регенерации HP или купите напиток с временными боевыми бонусами.',
    tooltipPosition: 'top',
  },
  // --- 21. Замок ---
  {
    targetSelector: '#action-card-Замок',
    title: 'Замок',
    description: 'Казна королевства, турниры, форум и другие общественные активности.',
    tooltipPosition: 'top',
  },
  // --- 22. Боевой журнал ---
  {
    targetSelector: '[data-tutorial="right-sidebar"]',
    title: 'Боевой журнал',
    description: 'Турниры, рейтинг игроков и ежедневные задания. Нажмите на свёрток, чтобы открыть панель.',
    tooltipPosition: 'left',
  },
  // --- 23. Чат ---
  {
    targetSelector: '[data-tutorial="chat-panel"]',
    title: 'Чат',
    description: 'Общайтесь с другими игроками! Вкладки: Общий чат, Гильдия, Аукцион и личные сообщения.',
    tooltipPosition: 'top',
  },
];

export default tutorialSteps;
