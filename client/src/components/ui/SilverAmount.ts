import { formatSilverNumber, type SilverAmount as SilverValue } from '../../utils/money.ts';

export interface SilverAmountProps {
  amount: SilverValue | null | undefined;
}

export function formatSilverAmount(amount: SilverAmountProps['amount']): string {
  return formatSilverNumber(amount);
}

export default function SilverAmount({ amount }: SilverAmountProps) {
  return formatSilverAmount(amount);
}
