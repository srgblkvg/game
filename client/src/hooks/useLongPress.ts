import { useRef, useCallback } from 'react';

export function useLongPress(
    onLongPress: (e: React.TouchEvent | React.MouseEvent) => void,
    onClick?: (e: React.MouseEvent) => void,
    delay = 500
) {
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isLongPress = useRef(false);

    const start = useCallback(
        (e: React.TouchEvent | React.MouseEvent) => {
            isLongPress.current = false;
            timerRef.current = setTimeout(() => {
                isLongPress.current = true;
                onLongPress(e);
            }, delay);
        },
        [onLongPress, delay]
    );

    const cancel = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const end = useCallback(
        (e: React.TouchEvent | React.MouseEvent) => {
            cancel();
            if (!isLongPress.current && onClick) {
                onClick(e as React.MouseEvent);
            }
            isLongPress.current = false;
        },
        [onClick, cancel]
    );

    return {
        onTouchStart: start,
        onTouchEnd: end,
        onTouchMove: cancel,
        onMouseDown: start,
        onMouseUp: end,
    };
}