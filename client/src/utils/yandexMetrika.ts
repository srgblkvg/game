export const YANDEX_METRIKA_ID = 111825817;

export type YandexMetrika = {
    (...args: unknown[]): void;
    a?: unknown[][];
    l?: number;
};

declare global {
    interface Window {
        ym?: YandexMetrika;
        __yandexMetrikaInitialized?: boolean;
    }
}

export function initYandexMetrika(): void {
    if (window.__yandexMetrikaInitialized) return;
    window.__yandexMetrikaInitialized = true;

    const ym = window.ym || Object.assign(function (...args: unknown[]) {
        ym.a ||= [];
        ym.a.push(args);
    } as YandexMetrika, { a: [] as unknown[][] });
    ym.l = ym.l || Date.now();
    window.ym = ym;

    const scriptSrc = `https://mc.yandex.ru/metrika/tag.js?id=${YANDEX_METRIKA_ID}`;
    if (!Array.from(document.scripts).some(script => script.src === scriptSrc)) {
        const script = document.createElement('script');
        script.async = true;
        script.src = scriptSrc;
        document.head.appendChild(script);
    }

    ym(YANDEX_METRIKA_ID, 'init', {
        ssr: true,
        webvisor: true,
        clickmap: true,
        ecommerce: 'dataLayer',
        referrer: document.referrer,
        url: window.location.href,
        accurateTrackBounce: true,
        trackLinks: true,
    });
}

export function reachYandexGoal(goal: 'guest_battle_click' | 'registration_success'): void {
    initYandexMetrika();
    window.ym?.(YANDEX_METRIKA_ID, 'reachGoal', goal);
}
