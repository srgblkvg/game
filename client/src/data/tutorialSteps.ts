export interface TutorialStep {
  targetSelector: string;
  title: string;
  description: string;
  tooltipPosition?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: string;
  autoAdvance?: boolean;
}

const tutorialSteps: TutorialStep[] = [
  {
    targetSelector: 'body',
    title: '⚔️ Становись сильнее',
    description: 'Главная цель — наращивать силу персонажа. Побеждай врагов, получай добычу и превращай её в улучшения.',
    tooltipPosition: 'center',
  },
  {
    targetSelector: 'body',
    title: '🗡️ Охота и добыча',
    description: 'Охота — основной источник серебра, материалов и экипировки. Побеждай доступных монстров и постепенно переходи к более сильным.',
    tooltipPosition: 'center',
  },
  {
    targetSelector: 'body',
    title: '🔨 Крафт и экипировка',
    description: 'Материалы используй в Ремесле: создавай и улучшай предметы. Надевай лучшую экипировку — она повышает характеристики и открывает более сложные бои.',
    tooltipPosition: 'center',
  },
  {
    targetSelector: 'body',
    title: '📚 Коллекции усиливают героя',
    description: 'Новые предметы пополняют Коллекцию и увеличивают характеристики. Цикл простой: охота → добыча → крафт и экипировка → коллекция → больше силы. За завершение обучения ты получишь 1000 серебра.',
    tooltipPosition: 'center',
  },
];

export default tutorialSteps;
