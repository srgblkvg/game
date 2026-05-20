import { useRef, useState, useEffect, useCallback } from 'react';
import Autocomplete from './Autocomplete';
import type { OnlineUser } from './types';

interface ChatInputProps {
    isPrivate: boolean;
    onlineUsers: OnlineUser[];
    currentUserId: number;
    onSend: (text: string) => void;
    bannedUntil: number | null;
    chatError: string | null;
    pendingMention?: string | null;
    onClearPending?: () => void;
}

export default function ChatInput({ isPrivate, onlineUsers, currentUserId, onSend, bannedUntil, chatError, pendingMention, onClearPending }: ChatInputProps) {
    const [input, setInput] = useState('');
    const [autocomplete, setAutocomplete] = useState<{ items: { id: number; name: string }[]; selectedIndex: number } | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const isBanned = bannedUntil !== null && bannedUntil > Date.now() / 1000;

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

    const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (isBanned) return;
        const value = e.target.value;
        setInput(value);
        buildAutocomplete(value, e.target.selectionStart || 0);
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
        setInput(before + name + ' ' + after);
        setAutocomplete(null);
        inputRef.current?.focus();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (isBanned) { e.preventDefault(); return; }
        if (e.key === 'Enter') {
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
        if (isBanned) return;
        const trimmed = input.trim();
        if (trimmed) {
            onSend(trimmed);
            setInput('');
            setAutocomplete(null);
        }
    };

    return (
        <div style={{ padding: '0.5rem', background: '#2a2a3e' }}>
            {isBanned && (
                <div style={{ color: '#e74c3c', fontSize: '0.8rem', marginBottom: '0.3rem', textAlign: 'center' }}>
                    Вы заблокированы в чате до {new Date(bannedUntil! * 1000).toLocaleString()}
                </div>
            )}
            {chatError && !isBanned && (
                <div style={{ color: '#e74c3c', fontSize: '0.8rem', marginBottom: '0.3rem', textAlign: 'center' }}>
                    {chatError}
                </div>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', position: 'relative' }}>
                <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={handleInput}
                    onKeyDown={handleKeyDown}
                    disabled={isBanned}
                    placeholder={isBanned ? 'Чат заблокирован' : (isPrivate ? 'Личное сообщение...' : 'Сообщение (или /w имя текст для шепота)')}
                    style={{
                        flex: 1,
                        padding: '0.3rem',
                        background: isBanned ? '#222' : '#333',
                        border: '1px solid #555',
                        borderRadius: '4px',
                        color: isBanned ? '#888' : '#fff',
                        cursor: isBanned ? 'not-allowed' : 'text',
                    }}
                />
                <button onClick={handleSendClick} disabled={isBanned} style={{
                    background: isBanned ? '#555' : '#e63946',
                    border: 'none', color: isBanned ? '#888' : '#fff',
                    padding: '0.3rem 0.8rem', borderRadius: '4px', cursor: isBanned ? 'not-allowed' : 'pointer',
                }}>➤</button>
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