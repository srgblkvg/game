import type { PlatformAdapter, PlatformId } from './types';

/** VK Mini App — детект по vk_user_id в URL */
export class VkAdapter implements PlatformAdapter {
    readonly id: PlatformId = 'vk';
    readonly name = 'VK';

    private _vkUser: string | null = null;

    get hasCustomKeyboard() { return true; }
    get hasScrollLock() { return true; }
    get hasSafeAreaTop() { return false; }
    get hasSafeAreaBottom() { return true; }
    get version() {
        return (typeof window !== 'undefined' && (window as any).vkBridge)
            ? 'vkBridge' : 'standalone';
    }
    get bodyClass() { return 'vk-iframe'; }
    get viewportMeta() { return 'width=device-width, initial-scale=1.0, maximum-scale=1.0'; }
    get allowSystemKeyboard() { return false; }

    get vkUserId(): string | null { return this._vkUser; }

    async init() {
        // Детектим vk_user_id из URL
        const params = new URLSearchParams(window.location.search);
        const vid = params.get('vk_user_id');
        if (vid) {
            this._vkUser = vid;
            sessionStorage.setItem('isVkIframe', '1');
        }
        // Флаг для авторизации
        localStorage.setItem('isVK', vid ? '1' : '0');
    }
}
