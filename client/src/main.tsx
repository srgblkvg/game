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