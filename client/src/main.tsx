// client/src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { GameProvider } from './contexts/GameContext';
import { ChatProvider } from './contexts/ChatContext';
import { AcquireProvider } from './contexts/AcquireContext';
import { ServerTimeProvider } from './contexts/ServerTimeContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { addCollection } from '@iconify/react';
import vkBridge from '@vkontakte/vk-bridge';
import gameIcons from './icons-filtered.json';
// TODO: удалить после ответа поддержки VK ↓
import { initVkInputMode } from './utils/vkInputMode';
// TODO: удалить после ответа поддержки VK ↑
import './styles/theme.css';
import { getPlatformAdapter } from './platforms/adapter';

// Bridge собирается вместе с клиентом: загрузка приложения больше не зависит
// от доступности внешнего CDN. Глобальный alias сохраняется для существующих
// экранов рекламы и платежей.
window.vkBridge = vkBridge;

// Определяем платформу
const platform = getPlatformAdapter();
platform.init();

// VK Bridge init
vkBridge.send('VKWebAppInit').catch(() => { /* вне VK инициализация не требуется */ });

// Применяем платформо-специфичные настройки
if (platform.bodyClass) {
  document.documentElement.classList.add(platform.bodyClass);
}

// Viewport meta
const vp = document.querySelector('meta[name="viewport"]');
if (vp) vp.setAttribute('content', platform.viewportMeta);

// Кастомная клавиатура VK
if (!platform.allowSystemKeyboard) {
  initVkInputMode();
}

// Регистрируем иконки локально (без API-запросов)
addCollection(gameIcons);

// После деплоя открытая старая вкладка может запросить уже удалённый lazy-chunk.
// Один раз обновляем страницу и загружаем актуальный index.html вместо белого экрана.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  const reloadKey = 'vite-preload-reload';
  const lastReload = Number(sessionStorage.getItem(reloadKey) || 0);
  if (Date.now() - lastReload > 60_000) {
    sessionStorage.setItem(reloadKey, String(Date.now()));
    window.location.reload();
  }
});

// Отправка непойманных ошибок на сервер
window.onerror = (message, source, lineno, colno, error) => {
    try {
        fetch('/api/log/error', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: String(message),
                stack: error?.stack?.slice(0, 1000),
                url: source,
                line: lineno,
                col: colno,
                userAgent: navigator.userAgent,
            }),
        });
    } catch { /* ignore send failures */ }
};

window.onunhandledrejection = (event) => {
    try {
        fetch('/api/log/error', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: `Unhandled rejection: ${String(event.reason)}`,
                stack: event.reason?.stack?.slice(0, 1000),
                userAgent: navigator.userAgent,
            }),
        });
    } catch { /* ignore */ }
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
    <AuthProvider>
      <GameProvider>
        <ChatProvider>
          <AcquireProvider>
            <ServerTimeProvider>
              <App />
            </ServerTimeProvider>
          </AcquireProvider>
        </ChatProvider>
      </GameProvider>
    </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);
