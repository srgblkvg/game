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

        ta.focus();
        const newCursor = start + prefix.length + selected.length + suffix.length;
        if (!ta.value.substring(start, end)) {
            ta.setSelectionRange(start + prefix.length, start + prefix.length + placeholder.length);
        } else {
            ta.setSelectionRange(newCursor, newCursor);
        }

        ta.dispatchEvent(new Event('input', { bubbles: true }));
    };

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
