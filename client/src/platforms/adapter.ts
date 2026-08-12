import type { PlatformAdapter } from './types';
import { BrowserAdapter } from './browser';
import { VkAdapter } from './vk';

// Синглтон-адаптер
let _adapter: PlatformAdapter | null = null;

/** Определяет платформу и возвращает правильный адаптер */
export function getPlatformAdapter(): PlatformAdapter {
    if (_adapter) return _adapter;

    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams('');

    // VK: vk_user_id в URL
    if (params.get('vk_user_id') || sessionStorage.getItem('isVkIframe') === '1') {
        _adapter = new VkAdapter();
        return _adapter;
    }

    // В будущем: OK, Yandex Games

    // Default
    _adapter = new BrowserAdapter();
    return _adapter;
}

/** Сброс кеша (для тестов) */
export function resetPlatformAdapter(): void {
    _adapter = null;
}
