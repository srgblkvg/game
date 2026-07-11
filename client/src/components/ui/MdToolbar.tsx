import { useRef, useCallback } from 'react';
import Button from './Button';

interface MdToolbarProps {
    textareaId: string;
    onChange: (value: string) => void;
}

const TOOLS = [
    { label: 'B', title: 'Жирный', prefix: '**', suffix: '**', placeholder: 'текст', className: 'font-bold' },
    { label: 'I', title: 'Курсив', prefix: '*', suffix: '*', placeholder: 'текст', className: 'italic' },
    { label: 'S', title: 'Зачёркнутый', prefix: '~~', suffix: '~~', placeholder: 'текст', className: 'line-through' },
    { label: 'H', title: 'Заголовок', prefix: '### ', suffix: '', placeholder: 'Заголовок', className: 'font-bold' },
    { label: '"', title: 'Цитата', prefix: '> ', suffix: '', placeholder: 'цитата', className: '' },
    { label: '•', title: 'Список', prefix: '- ', suffix: '', placeholder: 'элемент', className: '' },
];

export default function MdToolbar({ textareaId, onChange }: MdToolbarProps) {
    const pendingSelection = useRef<{ start: number; end: number } | null>(null);

    const insert = useCallback((prefix: string, suffix: string, placeholder: string) => {
        const ta = document.getElementById(textareaId) as HTMLTextAreaElement | null;
        if (!ta) return;

        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const selected = ta.value.substring(start, end) || placeholder;

        const before = ta.value.substring(0, start);
        const after = ta.value.substring(end);
        const newValue = before + prefix + selected + suffix + after;

        // Сохраняем позицию курсора для восстановления после рендера React
        const hasSelection = !!ta.value.substring(start, end);
        if (hasSelection) {
            const newCursor = start + prefix.length + selected.length + suffix.length;
            pendingSelection.current = { start: newCursor, end: newCursor };
        } else {
            pendingSelection.current = {
                start: start + prefix.length,
                end: start + prefix.length + placeholder.length,
            };
        }

        onChange(newValue);

        // Восстанавливаем курсор после React-рендера
        requestAnimationFrame(() => {
            const el = document.getElementById(textareaId) as HTMLTextAreaElement | null;
            if (el && pendingSelection.current) {
                el.focus();
                el.setSelectionRange(pendingSelection.current.start, pendingSelection.current.end);
                pendingSelection.current = null;
            }
        });
    }, [textareaId, onChange]);

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
