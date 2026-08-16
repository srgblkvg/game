import { useRef, useState, useEffect, useCallback } from 'react';
import Autocomplete from './Autocomplete';
import type { OnlineUser } from './types';
import { fmtSafeDate } from '../../utils/date';

interface ChatInputProps {
    isPrivate: boolean;
    isGuild?: boolean;
    onlineUsers: OnlineUser[];
    currentUserId: number;
    onSend: (text: string) => void;
    bannedUntil: number | null;
    chatError: string | null;
    pendingMention?: string | null;
    onClearPending?: () => void;
    isGuest?: boolean;
}

export default function ChatInput({ isPrivate, isGuild, onlineUsers, currentUserId, onSend, bannedUntil, chatError, pendingMention, onClearPending, isGuest }: ChatInputProps) {
    const [input, setInput] = useState('');
    const [autocomplete, setAutocomplete] = useState<{ items: { id: number; name: string }[]; selectedIndex: number } | null>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const resizeInput = useCallback(() => {
        const el = inputRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 112)}px`;
    }, []);

    const isBanned = bannedUntil !== null && bannedUntil > Date.now() / 1000;
    const isDisabled = isBanned;
    const disabledPlaceholder = isGuest ? 'Чат недоступен для гостей' : 'Чат заблокирован';

    useEffect(() => {
        resizeInput();
    }, [input, resizeInput]);

    // При ошибке валидации — восстанавливаем последний отправленный текст
    useEffect(() => {
        if (chatError && (window as any).__lastChatInput) {
            setInput((window as any).__lastChatInput);
            (window as any).__lastChatInput = null;
        }
    }, [chatError]);

    useEffect(() => {
        if (pendingMention && !isBanned) {
            setInput(prev => prev + pendingMention);
            inputRef.current?.focus();
            onClearPending?.();
        }
    }, [pendingMention, isBanned, onClearPending]);

    useEffect(() => {
        setAutocomplete(null);
    }, [isPrivate]);

    const buildAutocomplete = useCallback((value: string, cursorPos: number) => {
        const textBeforeCursor = value.slice(0, cursorPos);
        const atMatch = textBeforeCursor.match(/@(\S*)$/);
        const wMatch = textBeforeCursor.match(/\/w\s+(\S*)$/);

        const lastWord = atMatch ? atMatch[1] : wMatch ? wMatch[1] : null;
        if (lastWord !== null) {
            const filtered = onlineUsers
                .filter(u => u.id !== currentUserId && u.username.toLowerCase().startsWith(lastWord.toLowerCase()))
                .map(u => ({ id: u.id, name: u.username }));

            if (filtered.length > 0) {
                setAutocomplete({ items: filtered, selectedIndex: 0 });
                return;
            }
        }
        setAutocomplete(null);
    }, [onlineUsers, currentUserId]);

    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        if (isDisabled) return;
        const value = e.target.value;
        setInput(value);
        buildAutocomplete(value, e.target.selectionStart || 0);
        resizeInput();
    };

    const handleAutocompleteSelect = (name: string) => {
        const cursorPos = inputRef.current?.selectionStart || input.length;
        const textBefore = input.slice(0, cursorPos);
        const atMatch = textBefore.match(/@(\S*)$/);
        const wMatch = textBefore.match(/\/w\s+(\S*)$/);

        const before = atMatch
            ? textBefore.slice(0, atMatch.index! + 1)
            : wMatch ? textBefore.slice(0, wMatch.index! + 3) : textBefore;

        const after = input.slice(cursorPos);
        const nextValue = before + name + ' ' + after;
        const nextCursor = before.length + name.length + 1;
        setInput(nextValue);
        setAutocomplete(null);
        requestAnimationFrame(() => {
            const el = inputRef.current;
            if (!el) return;
            el.focus({ preventScroll: true });
            el.setSelectionRange(nextCursor, nextCursor);
            resizeInput();
        });
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (isBanned) { e.preventDefault(); return; }
        if (e.key === 'Enter') {
            if (e.shiftKey) return;
            e.preventDefault();
            if (autocomplete && autocomplete.items.length > 0) {
                e.preventDefault();
                handleAutocompleteSelect(autocomplete.items[autocomplete.selectedIndex].name);
                return;
            }
            const trimmed = input.trim();
            if (trimmed) {
                onSend(trimmed);
                setInput('');
                setAutocomplete(null);
                (window as any).__lastChatInput = trimmed; // сохраняем на случай ошибки
            }
            return;
        }
        if (autocomplete) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setAutocomplete(prev => prev ? { ...prev, selectedIndex: Math.min(prev.selectedIndex + 1, prev.items.length - 1) } : prev);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setAutocomplete(prev => prev ? { ...prev, selectedIndex: Math.max(prev.selectedIndex - 1, 0) } : prev);
            } else if (e.key === 'Escape') {
                setAutocomplete(null);
            }
        }
    };

    const handleSendClick = () => {
        if (isDisabled) return;
        const trimmed = input.trim();
        if (trimmed) {
            onSend(trimmed);
            setInput('');
            setAutocomplete(null);
            (window as any).__lastChatInput = trimmed;
        }
    };

    return (
        <div className="p-2 bg-[var(--color-bg-card)]">
            {isBanned && (
                <div className="text-[var(--color-accent-danger)] text-[0.8rem] mb-1 text-center">
                    Вы заблокированы в чате до {fmtSafeDate(bannedUntil!)}
                </div>
            )}
            {chatError && !isBanned && (
                <div className="text-[var(--color-accent-danger)] text-[0.8rem] mb-1 text-center">
                    {chatError}
                </div>
            )}
            <div className="flex gap-2 relative">
                <textarea
                    ref={inputRef}
                    value={input}
                    onChange={handleInput}
                    onKeyDown={handleKeyDown}
                    onFocus={resizeInput}
                    rows={1}
                    spellCheck={false}
                    disabled={isDisabled}
                    placeholder={isDisabled ? disabledPlaceholder : (isGuild ? 'Гильдия...' : isPrivate ? 'Личное сообщение...' : 'Сообщение (или /w ник текст для ЛС)')}
                    className={`flex-1 min-h-[30px] max-h-28 overflow-y-auto resize-none p-1 border border-[var(--color-border-light)] rounded leading-5 ${isDisabled ? 'bg-[var(--color-bg-input)] text-[var(--color-text-muted)] cursor-not-allowed' : 'bg-[var(--color-bg-input)] text-[var(--color-text-primary)] cursor-text'}`}
                />
                <button onClick={handleSendClick} disabled={isDisabled} className={`border-none rounded py-1 px-3 ${isDisabled ? 'bg-[var(--color-border-light)] text-[var(--color-text-muted)] cursor-not-allowed' : 'bg-[var(--color-accent-danger)] text-white cursor-pointer'}`}>➤</button>
                {autocomplete && (
                    <Autocomplete
                        items={autocomplete.items}
                        selectedIndex={autocomplete.selectedIndex}
                        onSelect={handleAutocompleteSelect}
                        onClose={() => setAutocomplete(null)}
                    />
                )}
            </div>
        </div>
    );
}
