export interface TutorialStep {
  targetSelector: string;
  title: string;
  description: string;
  tooltipPosition?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: string;
}

const tutorialSteps: TutorialStep[] = [
  {
    targetSelector: '#action-card-Охота',
    title: 'Охота',
    description: 'Нажми на Охоту чтобы сразиться с монстром в Склепе.',
    tooltipPosition: 'bottom',
  },
  {
    targetSelector: '[data-tutorial="bestiary-attack"]',
    title: 'Склеп',
    description: 'Нажми Атаковать чтобы начать бой с монстром.',
    tooltipPosition: 'right',
  },
  {
    targetSelector: '[data-tutorial="bestiary-back"]',
    title: 'Добыча',
    description: 'Забери добычу и нажми «На главную» для возврата.',
    tooltipPosition: 'top',
  },
  {
    targetSelector: '#action-card-Магазин',
    title: 'Магазин',
    description: 'Купи предмет в Магазине (вкладка Площадь).',
    tooltipPosition: 'top',
    action: 'tutorial-tab-castle',
  },
  {
    targetSelector: '[data-tutorial="shop-back"]',
    title: 'Выход',
    description: 'Осмотрись в магазине и нажми Назад.',
    tooltipPosition: 'bottom',
  },
  {
    targetSelector: '#action-card-Ремесло',
    title: 'Ремесло',
    description: 'Перейди в Ремесло для создания предмета.',
    tooltipPosition: 'top',
    action: 'tutorial-tab-castle',
  },
  {
    targetSelector: '[data-tutorial="craft-recipe"]',
    title: 'Рецепт',
    description: 'Выбери любой рецепт предмета.',
    tooltipPosition: 'right',
    action: 'tutorial-expand-craft-recipe',
  },
  {
    targetSelector: '[data-tutorial="craft-create"]',
    title: 'Создать',
    description: 'Нажми «Создать» чтобы скрафтить предмет.',
    tooltipPosition: 'top',
  },
  {
    targetSelector: '[data-tutorial="craft-back"]',
    title: 'На главную',
    description: 'Вернись на главную страницу.',
    tooltipPosition: 'top',
  },
  {
    targetSelector: '#action-card-Арена',
    title: 'Арена',
    description: 'Сразись с другим игроком на Арене. Победитель забирает серебро проигравшего.',
    tooltipPosition: 'bottom',
    action: 'tutorial-tab-world',
  },
];

export default tutorialSteps;
