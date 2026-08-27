export type AdHealState = {
    missingHp: number;
    loading: boolean;
    cooldown: number;
};

export type AdHealPresentation = {
    disabled: boolean;
    onCooldown: boolean;
    buttonText: string;
    hintText: string;
};

const READY_TEXT = '▶️ За рекламу — бесплатно';
const LOADING_TEXT = '⏳ Загрузка...';
const COOLDOWN_HINT = 'Подождите до следующего бесплатного лечения';
const READY_HINT = 'Полное восстановление HP за просмотр рекламы. Доступно раз в 5 минут.';

export function getAdHealPresentation({ missingHp, loading, cooldown }: AdHealState): AdHealPresentation {
    const onCooldown = cooldown > 0;
    const cdMin = Math.floor(cooldown / 60);
    const cdSec = cooldown % 60;
    const buttonText = onCooldown
        ? `⏳ ${cdMin}:${String(cdSec).padStart(2, '0')}`
        : loading ? LOADING_TEXT : READY_TEXT;

    return {
        disabled: missingHp <= 0 || loading || onCooldown,
        onCooldown,
        buttonText,
        hintText: onCooldown ? COOLDOWN_HINT : READY_HINT,
    };
}
