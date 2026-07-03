import type { PlatformAdapter, PlatformId } from './types';

/** Обычный браузер — дефолтный адаптер */
export class BrowserAdapter implements PlatformAdapter {
    readonly id: PlatformId = 'browser';
    readonly name = 'Browser';

    get hasCustomKeyboard() { return false; }
    get hasScrollLock() { return false; }
    get hasSafeAreaTop() { return false; }
    get hasSafeAreaBottom() { return false; }
    get version() { return navigator.userAgent.slice(0, 50); }
    get bodyClass() { return ''; }
    get viewportMeta() { return 'width=device-width, initial-scale=1.0'; }
    get allowSystemKeyboard() { return true; }

    async init() {}
}
