import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/** Отправляет pageView в Top.Mail.Ru / VK Pixel при каждой смене маршрута (SPA) */
export default function MetrikaTracker() {
  const { user } = useAuth();
  const location = useLocation();

  useEffect(() => {
    const w = window as any;
    w._tmr = w._tmr || [];
    w._tmr.push({
      id: "3771382",
      type: "pageView",
      start: (new Date()).getTime(),
      url: window.location.href,
      pid: user?.id ? String(user.id) : undefined,
    });
  }, [location, user?.id]);

  return null;
}
