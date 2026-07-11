import Button from './Button';
import { Icon } from '@iconify/react';

interface MdToolbarProps {
    textareaId: string;
    onInsert?: () => void;
}

const TOOLS = [
    { icon: 'game-icons:plain-dagger', label: 'Жирный', prefix: '**', suffix: '**', placeholder: 'текст' },
    { icon: 'game-icons:feather', label: 'Курсив', prefix: '*', suffix: '*', placeholder: 'текст' },
    { icon: 'game-icons:quill', label: 'Зачёркнутый', prefix: '~~', suffix: '~~', placeholder: 'текст' },
    { icon: 'game-icons:scroll-unfurled', label: 'Заголовок', prefix: '### ', suffix: '', placeholder: 'Заголовок' },
    { icon: 'game-icons:speech-bubble', label: 'Цитата', prefix: '> ', suffix: '', placeholder: 'цитата' },
    { icon: 'game-icons:pc', label: 'Код', prefix: '`', suffix: '`', placeholder: 'code' },
    { icon: 'game-icons:linked-rings', label: 'Ссылка', prefix: '[', suffix: '](url)', placeholder: 'текст' },
    { icon: 'game-icons:perspective-dice-six-faces-random', label: 'Список', prefix: '- ', suffix: '', placeholder: 'элемент' },
];

export default function MdToolbar({ textareaId }: MdToolbarProps) {
    const insert = (prefix: string, suffix: string, placeholder: string) => {
        const ta = document.getElementById(textareaId) as HTMLTextAreaElement | null;
        if (!ta) return;

        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const selected = ta.value.substring(start, end) || placeholder;

        const before = ta.value.substring(0, start);
        const after = ta.value.substring(end);
        ta.value = before + prefix + selected + suffix + after;

        // Восстановить фокус и выделение
        ta.focus();
        const newCursor = start + prefix.length + selected.length + suffix.length;
        if (!ta.value.substring(start, end)) {
            // Если не было выделения — выделяем placeholder для замены
            ta.setSelectionRange(start + prefix.length, start + prefix.length + placeholder.length);
        } else {
            ta.setSelectionRange(newCursor, newCursor);
        }

        // Триггерим onChange
        ta.dispatchEvent(new Event('input', { bubbles: true }));
    };

    return (
        <div className="flex gap-0.5 flex-wrap mb-2">
            {TOOLS.map(t => (
                <Button
                    key={t.label}
                    variant="secondary"
                    size="md"
                    title={t.label}
                    onClick={() => insert(t.prefix, t.suffix, t.placeholder)}
                >
                    <Icon icon={t.icon} width="14" height="14" />
                </Button>
            ))}
        </div>
    );
}
