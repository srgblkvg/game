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
    title: 'Первый бой',
    description: 'Нажми на «Охоту» и убей Костяную крысу в Склепе. С неё выпадет добыча — ресурсы и предметы.',
    tooltipPosition: 'bottom',
  },
  {
    targetSelector: '#action-card-Магазин',
    title: 'Покупка',
    description: 'Зайди в Магазин и купи зелье или предмет за добытое серебро. Трать с умом — серебро можно потерять на Арене.',
    tooltipPosition: 'top',
  },
  {
    targetSelector: '#action-card-Ремесло',
    title: 'Крафт',
    description: 'В Ремесле создавай и улучшай предметы из добытых ресурсов. Собранные коллекции дают постоянные бонусы к статам.',
    tooltipPosition: 'top',
  },
  {
    targetSelector: '#action-card-Арена',
    title: 'Ограбление',
    description: 'На Арене сразись с другим игроком. Победитель забирает процент серебра проигравшего. Храни сбережения в Банке!',
    tooltipPosition: 'bottom',
  },
];

export default tutorialSteps;
