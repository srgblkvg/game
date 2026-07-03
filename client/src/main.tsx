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
import gameIcons from './icons-filtered.json';
// TODO: удалить после ответа поддержки VK ↓
import { initVkInputMode } from './utils/vkInputMode';
// TODO: удалить после ответа поддержки VK ↑
import './styles/theme.css';

// VK Bridge init (для игр ВКонтакте)
declare global {
  interface Window {
    vkBridge?: any;
  }
}

// VK iframe-специфичные настройки (только когда игра внутри VK)
// vk_user_id есть только при первом запуске — сохраняем в sessionStorage
// чтобы перезагрузка фрейма (reload frame) не теряла настройки
const hasVkParam = new URLSearchParams(window.location.search).has('vk_user_id');
if (hasVkParam) sessionStorage.setItem('isVkIframe', '1');
const isVkIframe = hasVkParam || sessionStorage.getItem('isVkIframe') === '1';

if (window.vkBridge) {
  window.vkBridge.send('VKWebAppInit').catch(() => { /* ignore */ });
}

if (isVkIframe) {
  // Включаем скролл внутри iframe: фиксируем высоту body, контент скроллится
  document.documentElement.classList.add('vk-iframe');
  // Фикс авто-зума на iOS при фокусе на текстовые поля
  const vp = document.querySelector('meta[name="viewport"]');
  if (vp) vp.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
  // TODO: удалить после ответа поддержки VK ↓
  initVkInputMode();
  // TODO: удалить после ответа поддержки VK ↑
}

// Регистрируем иконки локально (без API-запросов)
addCollection(gameIcons);

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
