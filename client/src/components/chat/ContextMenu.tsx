import { Icon } from "@iconify/react";
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface ContextMenuProps {
    x: number;
    y: number;
    username: string;
    userId?: number;
    onWhisper: () => void;
    onProfile: () => void;
    onClose: () => void;
}

export default function ContextMenu({ x, y, onWhisper, onProfile, onClose }: ContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState({ left: x, top: y });

    // useLayoutEffect срабатывает синхронно после DOM-изменений, до браузерной отрисовки.
    // Это исключает видимый прыжок, потому что позиция пересчитывается до первого показа меню.
    useLayoutEffect(() => {
        if (!menuRef.current) return;
        const rect = menuRef.current.getBoundingClientRect();
        const { innerWidth, innerHeight } = window;

        let left = x;
        let top = y;

        // Если меню не влезает по высоте – показываем над курсором
        if (top + rect.height > innerHeight) {
            top = y - rect.height;
        }
        // Если не влезает по ширине – смещаем влево
        if (left + rect.width > innerWidth) {
            left = innerWidth - rect.width - 5;
        }
        // Минимальные отступы
        if (left < 5) left = 5;
        if (top < 5) top = 5;

        setPos({ left, top });
    }, [x, y]);

    // Закрытие по клику вне меню
    useEffect(() => {
        const handleClick = () => onClose();
        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, [onClose]);

    return createPortal(
        <div
            ref={menuRef}
            style={{
                position: 'fixed',
                left: pos.left,
                top: pos.top,
                background: '#2a2a3e',
                border: '1px solid #555',
                borderRadius: '6px',
                padding: '0.3rem 0',
                zIndex: 2000,
                color: '#eee',
                fontSize: '0.85rem',
                minWidth: '140px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.8)',
            }}
        >
            <div onClick={(e) => {
                e.stopPropagation();
                onWhisper();
            }} style={{ padding: '0.3rem 0.8rem', cursor: 'pointer' }}>
                Личное сообщение
            </div>
            <div onClick={onProfile} style={{ padding: '0.3rem 0.8rem', cursor: 'pointer' }}><Icon icon='game-icons:person' width='14' height='14' className="inline mr-1"/>Профиль</div>
        </div>,
        document.body
    );
}