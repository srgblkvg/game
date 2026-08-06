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
    description: 'Нажми на «Охоту» и убей монстра в Склепе — с него возможно выпадет добыча.',
    tooltipPosition: 'bottom',
  },
  {
    targetSelector: '#action-card-Магазин',
    title: 'Покупка',
    description: 'Купи предмет в Магазине за добытое серебро. Переключись на вкладку Площадь → Магазин.',
    tooltipPosition: 'top',
    action: 'tutorial-tab-castle',
  },
  {
    targetSelector: '#action-card-Ремесло',
    title: 'Крафт',
    description: 'Создай предмет в Ремесле из добытых ресурсов (Площадь → Ремесло).',
    tooltipPosition: 'top',
  },
  {
    targetSelector: '#action-card-Арена',
    title: 'Ограбление',
    description: 'Сразись с другим игроком на Арене (вкладка Мир). Победитель забирает процент серебра проигравшего.',
    tooltipPosition: 'bottom',
    action: 'tutorial-tab-world',
  },
];

export default tutorialSteps;
