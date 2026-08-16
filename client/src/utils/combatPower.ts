export function formatCombatPower(value: number | null | undefined): string {
    const power = Number(value) || 0;
    if (power < 1000) return String(Math.round(power));
    if (power < 1_000_000) {
        const formatted = (power / 1000).toFixed(power >= 100_000 ? 0 : 2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
        return `${formatted}K`;
    }
    const formatted = (power / 1_000_000).toFixed(power >= 100_000_000 ? 0 : 2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
    return `${formatted}M`;
}

export function formatPowerRange(min: number, max: number): string {
    if (Math.round(min) === Math.round(max)) return formatCombatPower(min);
    return `${formatCombatPower(min)}–${formatCombatPower(max)}`;
}
