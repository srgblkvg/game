// client/src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { GameProvider } from './contexts/GameContext';
import { ChatProvider } from './contexts/ChatContext';
import { AcquireProvider } from './contexts/AcquireContext';
import './styles/cormorant.css';
import './styles/theme.css';

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
    <AuthProvider>
      <GameProvider>
        <ChatProvider>
          <AcquireProvider>
            <App />
          </AcquireProvider>
        </ChatProvider>
      </GameProvider>
    </AuthProvider>
  </React.StrictMode>
);
