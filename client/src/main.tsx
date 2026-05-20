// client/src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { GameProvider } from './contexts/GameContext';
import { ChatProvider } from './contexts/ChatContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <GameProvider>
        <ChatProvider>
          <App />
        </ChatProvider>
      </GameProvider>
    </AuthProvider>
  </React.StrictMode>
);