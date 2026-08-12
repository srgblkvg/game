// Единый тип платформы
export type PlatformId = 'browser' | 'vk' | 'ok' | 'yandex';

// Интерфейс адаптера: все платформы реализуют его по-своему
export interface PlatformAdapter {
    readonly id: PlatformId;
    readonly name: string;

    // Инициализация (вызывается один раз при старте)
    init(): Promise<void>;

    // UI-флаги
    get hasCustomKeyboard(): boolean;
    get hasScrollLock(): boolean;
    get hasSafeAreaTop(): boolean;
    get hasSafeAreaBottom(): boolean;

    // Версия платформы (для дебага)
    get version(): string;

    // HTML-класс на body
    get bodyClass(): string;

    // Зум / масштабирование
    get viewportMeta(): string;

    // Можно ли использовать системную клавиатуру
    get allowSystemKeyboard(): boolean;

    // Платёжки (потом)
    // showAds?(): Promise<void>;
    // purchase?(itemId: string): Promise<PurchaseResult>;
}
