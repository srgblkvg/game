export interface JobDurationOption {
  label: string;
  value: number;
  icon: string;
}

export const JOB_DURATIONS: readonly JobDurationOption[] = [
  { label: '10 мин', value: 600, icon: 'game-icons:stopwatch' },
  { label: '30 мин', value: 1800, icon: 'game-icons:hourglass' },
  { label: '1 час', value: 3600, icon: 'game-icons:clockwork' },
  { label: '8 часов', value: 28800, icon: 'game-icons:sundial' },
];
