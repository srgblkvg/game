import { useCallback, useEffect } from 'react';
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

const pendingSelections = new Map<string, { start: number; end: number }>();

export function setMdSelection(textareaId: string, start: number, end: number) {
    pendingSelections.set(textareaId, { start, end });
}

export default function MdToolbar({ textareaId }: MdToolbarProps) {
    // Восстанавливаем позицию курсора после каждого рендера
    useEffect(() => {
        const sel = pendingSelections.get(textareaId);
        if (sel) {
            pendingSelections.delete(textareaId);
            const ta = document.getElementById(textareaId) as HTMLTextAreaElement | null;
            if (ta) {
                // Небольшая задержка чтобы React закончил обновление DOM
                requestAnimationFrame(() => {
                    ta.focus();
                    ta.setSelectionRange(sel.start, sel.end);
                });
            }
        }
    });

    const insert = useCallback((prefix: string, suffix: string, placeholder: string) => {
        const ta = document.getElementById(textareaId) as HTMLTextAreaElement | null;
        if (!ta) return;

        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const selected = ta.value.substring(start, end) || placeholder;

        const before = ta.value.substring(0, start);
        const after = ta.value.substring(end);
        const newValue = before + prefix + selected + suffix + after;

        const hasSelection = !!ta.value.substring(start, end);
        if (hasSelection) {
            const newCursor = start + prefix.length + selected.length + suffix.length;
            setMdSelection(textareaId, newCursor, newCursor);
        } else {
            setMdSelection(textareaId,
                start + prefix.length,
                start + prefix.length + placeholder.length
            );
        }

        // Сохраняем напрямую в DOM и диспатчим input для React
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype, 'value'
        )?.set;
        if (nativeInputValueSetter) {
            nativeInputValueSetter.call(ta, newValue);
        } else {
            ta.value = newValue;
        }
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
