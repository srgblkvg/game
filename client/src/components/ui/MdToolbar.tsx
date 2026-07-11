import { useCallback, useLayoutEffect } from 'react';
import Button from './Button';

interface MdToolbarProps {
    textareaId: string;
}

const TOOLS = [
    { label: 'B', title: 'Жирный', prefix: '**', suffix: '**', placeholder: 'текст', className: 'font-bold' },
    { label: 'I', title: 'Курсив', prefix: '*', suffix: '*', placeholder: 'текст', className: 'italic' },
    { label: 'S', title: 'Зачёркнутый', prefix: '~~', suffix: '~~', placeholder: 'текст', className: 'line-through' },
    { label: 'H', title: 'Заголовок', prefix: '### ', suffix: '', placeholder: 'Заголовок', className: 'font-bold' },
    { label: '"', title: 'Цитата', prefix: '> ', suffix: '', placeholder: 'цитата', className: '' },
    { label: '•', title: 'Список', prefix: '- ', suffix: '', placeholder: 'элемент', className: '' },
];

let pendingSel: { id: string; start: number; end: number } | null = null;

export default function MdToolbar({ textareaId }: MdToolbarProps) {
    useLayoutEffect(() => {
        if (pendingSel && pendingSel.id === textareaId) {
            const ta = document.getElementById(textareaId) as HTMLTextAreaElement | null;
            if (ta) {
                ta.focus();
                ta.setSelectionRange(pendingSel.start, pendingSel.end);
            }
            pendingSel = null;
        }
    });

    const insert = useCallback((prefix: string, suffix: string, placeholder: string) => {
        const ta = document.getElementById(textareaId) as HTMLTextAreaElement | null;
        if (!ta) return;

        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const hasSelection = start !== end;
        const selected = hasSelection ? ta.value.substring(start, end) : placeholder;

        const before = ta.value.substring(0, start);
        const after = ta.value.substring(end);
        const newValue = before + prefix + selected + suffix + after;

        if (hasSelection) {
            const newCursor = start + prefix.length + selected.length + suffix.length;
            pendingSel = { id: textareaId, start: newCursor, end: newCursor };
        } else {
            pendingSel = {
                id: textareaId,
                start: start + prefix.length,
                end: start + prefix.length + placeholder.length,
            };
        }

        // Прямая установка value через нативный сеттер
        const nativeSetter = Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype, 'value'
        )?.set;
        if (nativeSetter) {
            nativeSetter.call(ta, newValue);
        }
        // Диспатчим input для React-стейта
        ta.dispatchEvent(new Event('input', { bubbles: true }));
    }, [textareaId]);

    return (
        <div className="flex gap-0.5 flex-wrap mb-2">
            {TOOLS.map(t => (
                <Button
                    key={t.title}
                    variant="secondary"
                    size="md"
                    title={t.title}
                    onClick={() => insert(t.prefix, t.suffix, t.placeholder)}
                >
                    <span className={`text-xs ${t.className}`}>{t.label}</span>
                </Button>
            ))}
        </div>
    );
}
