import { formatCountdown, formatCountdownMinutes } from '../../utils/countdown';

interface CountdownProps {
  seconds: number | null | undefined;
  prefix?: string;
  precision?: 'seconds' | 'minutes';
  className?: string;
}

export default function Countdown({ seconds, prefix = '', precision = 'seconds', className = '' }: CountdownProps) {
  const text = precision === 'minutes' ? formatCountdownMinutes(seconds) : formatCountdown(seconds);
  return <span className={className}>{prefix}{text}</span>;
}