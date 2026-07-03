export interface TutorialStep {
  targetSelector: string;
  title: string;
  description: string;
  tooltipPosition?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: string;
}

const tutorialSteps: TutorialStep[] = [
  // --- 1. Шапка ---
  {
    targetSelector: '#site-header',
    title: 'Шапка',
    description: 'Здесь отображается ваше серебро, статус защиты, игровое время и настройки...',
    tooltipPosition: 'bottom',
    action: '__header__',
  },
  // --- 2. Персонаж ---
  {
    targetSelector: '[data-tutorial="character-card"]',
    title: 'Ваш персонаж',
    description: 'Карточка персонажа: имя, уровень, здоровье, опыт и экипировка...',
    tooltipPosition: 'right',
  },
  // --- 3. Характеристики (разворачиваем) ---
  {
    targetSelector: '[data-tutorial="stat-allocation"]',
    title: 'Характеристики',
    description: 'При достижении нового уровня вы получаете очки характеристик...',
    tooltipPosition: 'right',
    action: 'tutorial-expand-stats',
  },
  // --- 4-7. Статы ---
  {
    targetSelector: '[data-tutorial-stat="s"]',
    title: 'Сила',
    description: 'Увеличивает урон в атаке.',
    tooltipPosition: 'right',
  },
  {
    targetSelector: '[data-tutorial-stat="a"]',
    title: 'Ловкость',
    description: 'Повышает уклонение и очерёдность хода.',
    tooltipPosition: 'right',
  },
  {
    targetSelector: '[data-tutorial-stat="d"]',
    title: 'Защита',
    description: 'Увеличивает шанс и силу блока.',
    tooltipPosition: 'right',
  },
  {
    targetSelector: '[data-tutorial-stat="m"]',
    title: 'Мастерство',
    description: 'Влияет на шанс крита, контратаки и оглушения.',
    tooltipPosition: 'right',
  },
  // --- 8. Сворачиваем статы ---
  {
    targetSelector: '[data-tutorial="stat-allocation"]',
    title: 'Готово!',
    description: 'Сворачиваем характеристики — они всегда под рукой.',
    action: 'tutorial-collapse-stats',
  },
  // --- 9. Усиления (разворачиваем) ---
  {
    targetSelector: '[data-tutorial="buffs-block"]',
    title: 'Усиления',
    description: 'Временные и постоянные баффы. Комнаты, напитки, премиум, коллекции.',
    tooltipPosition: 'right',
    action: 'tutorial-expand-buffs',
  },
  // --- 10-13. Категории усилений ---
  {
    targetSelector: '[data-tutorial-buff="room"]',
    title: 'Комната',
    description: 'Снимается в Трактире. Ускоряет регенерацию HP.',
    tooltipPosition: 'right',
  },
  {
    targetSelector: '[data-tutorial-buff="drink"]',
    title: 'Напиток',
    description: 'Временные боевые бонусы: ярость, тени, камень, око.',
    tooltipPosition: 'right',
  },
  {
    targetSelector: '[data-tutorial-buff="premium"]',
    title: 'Премиум',
    description: 'Сокращает кулдауны, бонус к опыту и наградам.',
    tooltipPosition: 'right',
  },
  {
    targetSelector: '[data-tutorial-buff="collection"]',
    title: 'Коллекция',
    description: 'Собирайте сеты — каждый даёт постоянный бонус к статам.',
    tooltipPosition: 'right',
  },
  // --- 14. Сворачиваем усиления ---
  {
    targetSelector: '[data-tutorial="buffs-block"]',
    title: 'Готово!',
    description: 'Сворачиваем усиления.',
    action: 'tutorial-collapse-buffs',
  },
  // --- 15. Инвентарь (разворачиваем) ---
  {
    targetSelector: '[data-tutorial="inventory"]',
    title: 'Инвентарь',
    description: 'Все ваши предметы и ресурсы. Нажмите на предмет, затем на слот персонажа, чтобы экипировать.',
    tooltipPosition: 'right',
    action: 'tutorial-expand-inventory',
  },
  // --- 16. Сворачиваем инвентарь ---
  {
    targetSelector: '[data-tutorial="inventory"]',
    title: 'Готово!',
    description: 'Сворачиваем инвентарь — он всегда доступен.',
    action: 'tutorial-collapse-inventory',
  },
  // --- 17. Действия — Замок первый ---
  {
    targetSelector: '#action-card-Замок',
    title: 'Замок',
    description: 'Казна королевства, турниры, форум и другие общественные активности.',
    tooltipPosition: 'top',
  },
  // --- 18. Переключатели Мир / Площадь ---
  {
    targetSelector: '[data-tutorial="actions"]',
    title: 'Мир и Площадь',
    description: 'Занятия разделены на две вкладки. Мир — PvE и PvP с таймерами. Площадь — торговля, гильдии,社交.',
    tooltipPosition: 'left',
  },
  // --- 19-22. Карточки Мира ---
  {
    targetSelector: '#action-card-Охота',
    title: 'Охота (PvE)',
    description: 'Сражение с монстрами. Основной источник добычи и ресурсов.',
    tooltipPosition: 'bottom',
  },
  {
    targetSelector: '#action-card-Арена',
    title: 'Арена (PvP)',
    description: 'Бой с другим игроком. Победитель забирает процент серебра противника.',
    tooltipPosition: 'bottom',
  },
  {
    targetSelector: '#action-card-Работы',
    title: 'Работы',
    description: 'AFK-экспедиция — персонаж работает даже когда вы не в игре.',
    tooltipPosition: 'top',
  },
  {
    targetSelector: '#action-card-Резня',
    title: 'Резня',
    description: 'Хаотичный PvP-режим — все против всех. Участвуйте, когда событие активно.',
    tooltipPosition: 'top',
  },
  // --- 23. Переключаемся на Площадь ---
  {
    targetSelector: '[data-tutorial="actions"]',
    title: 'Переключаемся',
    description: 'Теперь посмотрим карточки на вкладке Площадь.',
    action: 'tutorial-tab-castle',
  },
  // --- 24-29. Карточки Площади ---
  {
    targetSelector: '#action-card-Аукцион',
    title: 'Аукцион',
    description: 'Выставляйте предметы на продажу или покупайте нужное.',
    tooltipPosition: 'top',
  },
  {
    targetSelector: '#action-card-Банк',
    title: 'Банк',
    description: 'Храните серебро в безопасности. Деньги в банке нельзя потерять.',
    tooltipPosition: 'top',
  },
  {
    targetSelector: '#action-card-Ремесло',
    title: 'Ремесло',
    description: 'Создавайте и улучшайте предметы из добытых ресурсов.',
    tooltipPosition: 'top',
  },
  {
    targetSelector: '#action-card-Магазин',
    title: 'Магазин',
    description: 'Покупайте базовые предметы и расходники за серебро.',
    tooltipPosition: 'top',
  },
  {
    targetSelector: '#action-card-Трактир',
    title: 'Трактир',
    description: 'Снимите комнату для регенерации или купите боевой напиток.',
    tooltipPosition: 'top',
  },
  {
    targetSelector: '#action-card-Гильдия',
    title: 'Гильдия',
    description: 'Вступайте в гильдии, участвуйте в войнах, выполняйте квесты.',
    tooltipPosition: 'top',
  },
  // --- 30. Боевой журнал ---
  {
    targetSelector: '[data-tutorial="right-sidebar"]',
    title: 'Боевой журнал',
    description: 'Турниры, рейтинг игроков и ежедневные задания.',
    tooltipPosition: 'left',
    action: '__header__',
  },
  // --- 31. Чат ---
  {
    targetSelector: '[data-tutorial="chat-panel"]',
    title: 'Чат',
    description: 'Общайтесь с игроками! Вкладки: Общий, Гильдия, Аукцион и личные сообщения.',
    tooltipPosition: 'top',
  },
];

export default tutorialSteps;
