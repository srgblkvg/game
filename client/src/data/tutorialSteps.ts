export interface TutorialStep {
  targetSelector: string;
  title: string;
  description: string;
  tooltipPosition?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: string;
}

const tutorialSteps: TutorialStep[] = [
  {
    targetSelector: '#site-header',
    title: 'Шапка',
    description: 'Здесь отображается ваше серебро, статус защиты, игровое время и настройки. Кнопка «Сводка» покажет историю боёв и личные сообщения.',
    tooltipPosition: 'bottom',
    action: '__header__',
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
    description: 'При достижении нового уровня вы получаете очки характеристик. Распределяйте их между Силой, Ловкостью, Защитой и Мастерством.',
    tooltipPosition: 'right',
    action: 'tutorial-expand-stats',
  },
  {
    targetSelector: '[data-tutorial-stat="s"]',
    title: 'Сила',
    description: 'Увеличивает урон в атаке. Каждое очко делает ваши удары сильнее.',
    tooltipPosition: 'right',
  },
  {
    targetSelector: '[data-tutorial-stat="a"]',
    title: 'Ловкость',
    description: 'Повышает уклонение и определяет очерёдность хода в бою. Быстрые персонажи атакуют первыми.',
    tooltipPosition: 'right',
  },
  {
    targetSelector: '[data-tutorial-stat="d"]',
    title: 'Защита',
    description: 'Увеличивает шанс и силу блока. Заблокированный удар наносит меньше урона.',
    tooltipPosition: 'right',
  },
  {
    targetSelector: '[data-tutorial-stat="m"]',
    title: 'Мастерство',
    description: 'Влияет на шанс критического удара, контратаки и оглушения противника.',
    tooltipPosition: 'right',
  },
  {
    targetSelector: '[data-tutorial="buffs-block"]',
    title: 'Усиления',
    description: 'Временные и постоянные баффы. Комнаты ускоряют регенерацию здоровья, напитки дают боевые бонусы, премиум сокращает кулдауны. Коллекции — постоянный бонус к статам.',
    tooltipPosition: 'right',
    action: 'tutorial-expand-buffs',
  },
  {
    targetSelector: '[data-tutorial-buff="room"]',
    title: 'Комната',
    description: 'Снимается в Трактире. Ускоряет восстановление здоровья: Чулан x3, Койка x10, Аппартаменты x50.',
    tooltipPosition: 'right',
  },
  {
    targetSelector: '[data-tutorial-buff="drink"]',
    title: 'Напиток',
    description: 'Покупается в Трактире. Даёт временные боевые бонусы: ярость (+Сила), тени (+Ловкость), камень (+Защита), око (+Мастерство).',
    tooltipPosition: 'right',
  },
  {
    targetSelector: '[data-tutorial-buff="premium"]',
    title: 'Премиум',
    description: 'Сокращает кулдауны PvP и PvE вдвое, даёт бонус к опыту и наградам.',
    tooltipPosition: 'right',
  },
  {
    targetSelector: '[data-tutorial-buff="collection"]',
    title: 'Коллекция',
    description: 'Собирайте предметы экипировки — каждый сет даёт постоянный бонус к статам.',
    tooltipPosition: 'right',
  },
  {
    targetSelector: '[data-tutorial="inventory"]',
    title: 'Инвентарь',
    description: 'Все ваши предметы и ресурсы. Нажмите на предмет, затем на слот персонажа, чтобы экипировать. Предметы можно продать или использовать.',
    tooltipPosition: 'right',
    action: 'tutorial-expand-inventory',
  },
  {
    targetSelector: '#action-card-Замок',
    title: 'Замок',
    description: 'Казна королевства, турниры, форум и другие общественные активности.',
    tooltipPosition: 'top',
  },
  {
    targetSelector: '[data-tutorial="actions"]',
    title: 'Мир и Площадь',
    description: 'Занятия разделены на две вкладки. Мир — PvE и PvP с таймерами. Площадь — торговля, гильдии, общение.',
    tooltipPosition: 'left',
  },
  {
    targetSelector: '#action-card-Охота',
    title: 'Охота (PvE)',
    description: 'Сражение с монстрами. С них выпадают ресурсы и предметы экипировки. Основной источник добычи.',
    tooltipPosition: 'bottom',
  },
  {
    targetSelector: '#action-card-Арена',
    title: 'Арена (PvP)',
    description: 'Бой с другим игроком. Победитель забирает процент серебра, которое противник носит с собой. Храните сбережения в Банке!',
    tooltipPosition: 'bottom',
  },
  {
    targetSelector: '#action-card-Работы',
    title: 'Работы',
    description: 'Отправьте персонажа на работу — через время он вернётся с серебром и опытом. Работает даже когда вы не в игре.',
    tooltipPosition: 'top',
  },
  {
    targetSelector: '#action-card-Резня',
    title: 'Резня',
    description: 'Хаотичный PvP-режим — все против всех. Участвуйте, когда событие активно.',
    tooltipPosition: 'top',
  },
  {
    targetSelector: '[data-tutorial="actions"]',
    title: 'Переключаемся',
    description: 'Теперь посмотрим карточки на вкладке Площадь.',
    action: 'tutorial-tab-castle',
  },
  {
    targetSelector: '#action-card-Аукцион',
    title: 'Аукцион',
    description: 'Выставляйте предметы на продажу другим игрокам или покупайте нужное. Ставки делаются серебром.',
    tooltipPosition: 'top',
  },
  {
    targetSelector: '#action-card-Банк',
    title: 'Банк',
    description: 'Храните серебро в безопасности. Деньги в банке нельзя потерять при поражении на Арене.',
    tooltipPosition: 'top',
  },
  {
    targetSelector: '#action-card-Ремесло',
    title: 'Ремесло',
    description: 'Создавайте и улучшайте предметы из добытых ресурсов. Собранные коллекции дают постоянные бонусы.',
    tooltipPosition: 'top',
  },
  {
    targetSelector: '#action-card-Магазин',
    title: 'Магазин',
    description: 'Покупайте предметы и расходники за серебро.',
    tooltipPosition: 'top',
  },
  {
    targetSelector: '#action-card-Трактир',
    title: 'Трактир',
    description: 'Снимите комнату для ускоренной регенерации или купите напиток с временными боевыми бонусами.',
    tooltipPosition: 'top',
  },
  {
    targetSelector: '#action-card-Гильдия',
    title: 'Гильдия',
    description: 'Вступайте в гильдии, участвуйте в войнах, выполняйте квесты и получайте бонусы.',
    tooltipPosition: 'top',
  },
  {
    targetSelector: '[data-tutorial="right-sidebar"]',
    title: 'Боевой журнал',
    description: 'Турниры, рейтинг игроков и ежедневные задания. Нажмите на свёрток, чтобы открыть панель.',
    tooltipPosition: 'left',
    action: '__header__',
  },
  {
    targetSelector: '[data-tutorial="chat-panel"]',
    title: 'Чат',
    description: 'Общайтесь с другими игроками! Вкладки: Общий чат, Гильдия, Аукцион и личные сообщения.',
    tooltipPosition: 'top',
  },
];

export default tutorialSteps;
