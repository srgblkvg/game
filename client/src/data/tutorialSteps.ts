export interface TutorialStep {
  targetSelector: string;
  title: string;
  description: string;
  tooltipPosition?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: string;
  /** Если true — кнопка «Далее» не показывается, шаг продвигается сервером после действия */
  autoAdvance?: boolean;
}

const tutorialSteps: TutorialStep[] = [
  // Шаг 0: Приветствие
  {
    targetSelector: 'body',
    title: '🏰 Добро пожаловать в MMO Arena!',
    description: 'Этот короткий гайд покажет основы игры: бой, магазин, крафт, PvP, статы и инвентарь. Нажми «Далее» чтобы начать.',
    tooltipPosition: 'center',
  },
  // Шаг 1: Статы персонажа
  {
    targetSelector: '[data-tutorial="character-card"]',
    title: '📊 Характеристики',
    description: 'Здесь твои статы. Сила (S) — урон, Ловкость (A) — уклонение, Защита (D) — блок, Мастерство (M) — крит. HP = S+A+M. Распределяй очки с умом!',
    tooltipPosition: 'right',
  },
  // Шаг 2: Охота (PvE)
  {
    targetSelector: '#action-card-Охота',
    title: '⚔️ Охота на монстров',
    description: 'Нажми на карточку «Охота» чтобы отправиться в Склеп и сразиться с монстром. За победу получишь опыт, серебро и добычу.',
    tooltipPosition: 'bottom',
    action: 'tutorial-tab-world',
  },
  // Шаг 3: Атака на странице бестиария
  {
    targetSelector: '[data-tutorial="bestiary-attack"]',
    title: '👊 Атака',
    description: 'Выбери этаж и нажми «Атаковать» чтобы начать бой. Твои статы и экипировка влияют на исход.',
    tooltipPosition: 'right',
  },
  // Шаг 4: После боя — возврат
  {
    targetSelector: '[data-tutorial="bestiary-back"]',
    title: '🏠 Возвращение',
    description: 'Бой окончен! Нажми «На главную» чтобы вернуться и продолжить обучение.',
    tooltipPosition: 'top',
  },
  // Шаг 5: Магазин
  {
    targetSelector: '#action-card-Магазин',
    title: '🛒 Магазин',
    description: 'Перейди в Магазин чтобы купить предметы экипировки. Ассортимент обновляется каждый день.',
    tooltipPosition: 'top',
    action: 'tutorial-tab-castle',
  },
  // Шаг 6: Покупка предмета
  {
    targetSelector: '[data-tutorial="shop-buy-first"]',
    title: '💰 Покупка',
    description: 'Выбери любой предмет и нажми «Купить». Нельзя надеть два одинаковых кольца или два оружия.',
    tooltipPosition: 'top',
  },
  // Шаг 7: Ремесло (Крафт)
  {
    targetSelector: '#action-card-Ремесло',
    title: '🔨 Ремесло',
    description: 'В Ремесле ты можешь создавать предметы из материалов. Также здесь улучшают и проклинают экипировку.',
    tooltipPosition: 'top',
    action: 'tutorial-tab-castle',
  },
  // Шаг 8: Создание предмета
  {
    targetSelector: '[data-tutorial="craft-create"]',
    title: '⚒️ Создание',
    description: 'Выбери рецепт, перетащи материалы в верстак и нажми «Создать». Шанс успеха зависит от редкости.',
    tooltipPosition: 'left',
    action: 'tutorial-expand-craft-recipe',
  },
  // Шаг 9: Инвентарь
  {
    targetSelector: '[data-tutorial="inventory"]',
    title: '🎒 Инвентарь',
    description: 'Здесь всё твоё добро: предметы, материалы, камни улучшения. Надевай экипировку перетаскиванием или двойным кликом.',
    tooltipPosition: 'top',
  },
  // Шаг 10: Арена (PvP)
  {
    targetSelector: '#action-card-Арена',
    title: '⚔️ Арена — PvP',
    description: 'Сразись с другим игроком! Победитель получает серебро проигравшего. Твои статы и тактика решают исход.',
    tooltipPosition: 'bottom',
    action: 'tutorial-tab-world',
  },
  // Шаг 11: Завершение
  {
    targetSelector: 'body',
    title: '🎉 Обучение пройдено!',
    description: 'Отлично! Теперь ты знаешь основы MMO Arena. Исследуй другие возможности: Гильдия, Аукцион, Турниры, Трактир, Замок, Резня и многое другое. Удачи!',
    tooltipPosition: 'center',
  },
];

export default tutorialSteps;
