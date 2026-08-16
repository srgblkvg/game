import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function ActivityRouteTracker() {
    const location = useLocation();

    useEffect(() => {
        window.dispatchEvent(new CustomEvent('gameRouteChange', {
            detail: location.pathname,
        }));
    }, [location.pathname]);

    return null;
}
