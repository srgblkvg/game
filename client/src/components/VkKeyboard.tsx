/**
 * TODO: Удалить весь файл после ответа поддержки VK (проблема с клавиатурой в WebView).
 * Вместе с этим файлом удалить: vkInputMode.ts, импорты/вызовы в main.tsx и App.tsx,
 * CSS-правила в theme.css (VK keyboard + chat panel bottom + light theme overrides).
 */
import { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';

type Layout = 'ru' | 'en' | 'num';

const LAYOUTS: Record<Layout, string[][]> = {
  ru: [
    ['й', 'ц', 'у', 'к', 'е', 'н', 'г', 'ш', 'щ', 'з', 'х', 'ъ'],
    ['ф', 'ы', 'в', 'а', 'п', 'р', 'о', 'л', 'д', 'ж', 'э'],
    ['⇧', 'я', 'ч', 'с', 'м', 'и', 'т', 'ь', 'б', 'ю', '.', '⌫'],
    ['123', 'en', '␣', '↩'],
  ],
  en: [
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
    ['⇧', 'z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '⌫'],
    ['123', 'ru', '␣', '↩'],
  ],
  num: [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['@', '#', '$', '%', '&', '*', '-', '+', '(', ')'],
    ['!', '"', "'", ':', ';', '/', '?', ',', '.', '⌫'],
    ['abc', 'ru', '␣', '↩'],
  ],
};

const SHIFT_MAP: Record<string, string> = {
  'й': 'Й', 'ц': 'Ц', 'у': 'У', 'к': 'К', 'е': 'Е', 'н': 'Н', 'г': 'Г',
  'ш': 'Ш', 'щ': 'Щ', 'з': 'З', 'х': 'Х', 'ъ': 'Ъ', 'ф': 'Ф', 'ы': 'Ы',
  'в': 'В', 'а': 'А', 'п': 'П', 'р': 'Р', 'о': 'О', 'л': 'Л', 'д': 'Д',
  'ж': 'Ж', 'э': 'Э', 'я': 'Я', 'ч': 'Ч', 'с': 'С', 'м': 'М', 'и': 'И',
  'т': 'Т', 'ь': 'Ь', 'б': 'Б', 'ю': 'Ю',
  'q': 'Q', 'w': 'W', 'e': 'E', 'r': 'R', 't': 'T', 'y': 'Y', 'u': 'U',
  'i': 'I', 'o': 'O', 'p': 'P', 'a': 'A', 's': 'S', 'd': 'D', 'f': 'F',
  'g': 'G', 'h': 'H', 'j': 'J', 'k': 'K', 'l': 'L', 'z': 'Z', 'x': 'X',
  'c': 'C', 'v': 'V', 'b': 'B', 'n': 'N', 'm': 'M',
};

const NO_REPEAT = new Set(['⇧', '⌫', '␣', '↩', 'ru', 'en', '123', 'abc']);

function isTextInput(el: HTMLElement): boolean {
  if (el.tagName === 'TEXTAREA') return true;
  if (el.tagName === 'INPUT') {
    const type = (el as HTMLInputElement).type;
    return !['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'image', 'hidden', 'range', 'color'].includes(type);
  }
  return el.isContentEditable;
}

function insertChar(el: HTMLInputElement | HTMLTextAreaElement, char: string) {
  el.focus();
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  el.setRangeText(char, start, end, 'end');
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

function deleteChar(el: HTMLInputElement | HTMLTextAreaElement) {
  el.focus();
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  if (start !== end) {
    el.setRangeText('', start, end, 'end');
  } else if (start > 0) {
    el.setRangeText('', start - 1, start, 'start');
  }
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

export default function VkKeyboard() {
  const [layout, setLayout] = useState<Layout>('ru');
  const [shift, setShift] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [active, setActive] = useState<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const activeRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const kbRef = useRef<HTMLDivElement>(null);
  const repeatInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const longPressTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastShiftTime = useRef(0);

  useEffect(() => { activeRef.current = active; }, [active]);

  // Показываем клавиатуру в любом VK WebView (класс vk-iframe добавляется при детекте VK Bridge)
  const isVKWebView = typeof document !== 'undefined'
    && document.documentElement.classList.contains('vk-iframe');

  const stopRepeat = useCallback(() => {
    if (longPressTimeout.current) { clearTimeout(longPressTimeout.current); longPressTimeout.current = null; }
    if (repeatInterval.current) { clearInterval(repeatInterval.current); repeatInterval.current = null; }
  }, []);

  useEffect(() => stopRepeat, [stopRepeat]);

  // Notify body about keyboard height
  useLayoutEffect(() => {
    if (active && kbRef.current) {
      document.body.style.setProperty('--vk-keyboard-height', kbRef.current.offsetHeight + 'px');
    } else {
      document.body.style.removeProperty('--vk-keyboard-height');
    }
    return () => { document.body.style.removeProperty('--vk-keyboard-height'); };
  }, [active]);

  // Force-keep input focus while keyboard is visible (Android WebView loses it)
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      if (activeRef.current) activeRef.current.focus();
    }, 80);
    return () => clearInterval(id);
  }, [active]);

  // Track active input — show on focus, hide on tap outside
  useEffect(() => {
    const onFocus = (e: FocusEvent) => {
      const el = e.target as HTMLElement;
      if (isTextInput(el)) setActive(el as HTMLInputElement | HTMLTextAreaElement);
    };
    const onTap = (e: Event) => {
      const target = e.target as HTMLElement;
      if (isTextInput(target)) return;
      if (target.closest('.vk-keyboard')) return;
      setActive(null); setShift(false); setCapsLock(false);
    };
    document.addEventListener('focusin', onFocus);
    document.addEventListener('touchstart', onTap);
    document.addEventListener('mousedown', onTap);
    return () => {
      document.removeEventListener('focusin', onFocus);
      document.removeEventListener('touchstart', onTap);
      document.removeEventListener('mousedown', onTap);
    };
  }, []);

  const doDelete = useCallback(() => {
    const el = activeRef.current;
    if (!el) return;
    deleteChar(el);
  }, []);

  const doInsert = useCallback((char: string) => {
    const el = activeRef.current;
    if (!el) return;
    insertChar(el, char);
  }, []);

  const startCharRepeat = useCallback((char: string) => {
    doInsert(char);
    longPressTimeout.current = setTimeout(() => {
      repeatInterval.current = setInterval(() => doInsert(char), 50);
    }, 600);
  }, [doInsert]);

  const startBackspaceRepeat = useCallback(() => {
    doDelete();
    longPressTimeout.current = setTimeout(() => {
      repeatInterval.current = setInterval(() => {
        const el = activeRef.current;
        if (!el) { stopRepeat(); return; }
        const s = el.selectionStart ?? 0;
        const e = el.selectionEnd ?? 0;
        if (s === 0 && e === 0) { stopRepeat(); return; }
        deleteChar(el);
      }, 50);
    }, 600);
  }, [doDelete, stopRepeat]);

  const handleShift = useCallback(() => {
    const now = Date.now();
    if (now - lastShiftTime.current < 400) {
      // Double-tap: toggle caps lock
      setCapsLock(c => !c);
      setShift(false);
    } else {
      setShift(s => !s);
      setCapsLock(false);
    }
    lastShiftTime.current = now;
  }, []);

  const handleKey = useCallback((key: string) => {
    if (key === '⌫') {
      doDelete();
    } else if (key === '␣') {
      doInsert(' ');
    } else if (key === '↩') {
      const el = activeRef.current;
      if (!el) return;
      if (el.tagName === 'INPUT') {
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      } else {
        insertChar(el, '\n');
      }
    } else if (key === '⇧') {
      handleShift();
    } else if (key === '123') { setLayout('num'); setShift(false); setCapsLock(false); }
    else if (key === 'en')  { setLayout('en');  setShift(false); setCapsLock(false); }
    else if (key === 'ru')  { setLayout('ru');  setShift(false); setCapsLock(false); }
    else if (key === 'abc') { setLayout('en');  setShift(false); setCapsLock(false); }
    else {
      const char = (shift || capsLock) && SHIFT_MAP[key] ? SHIFT_MAP[key] : key;
      doInsert(char);
      if (shift && !capsLock) setShift(false);
    }
  }, [shift, capsLock, doInsert, handleShift]);

  const handleTouchStart = useCallback((key: string, char: string, isBackspace: boolean, canRepeat: boolean) => {
    stopRepeat(); // clear any pending
    if (isBackspace) {
      startBackspaceRepeat();
    } else if (canRepeat) {
      startCharRepeat(char);
      if (shift && !capsLock) setShift(false); // reset one-time shift
    } else {
      handleKey(key);
    }
  }, [handleKey, startCharRepeat, startBackspaceRepeat, stopRepeat]);

  if (!isVKWebView || !active) return null;

  const keys = LAYOUTS[layout];
  const effectiveShift = shift || capsLock;

  return (
    <div ref={kbRef} className="vk-keyboard fixed bottom-0 left-0 right-0 z-[10000] select-none bg-[var(--vk-kb-bg,#1a1a2e)] border-t border-[var(--vk-kb-border,#333)] px-1 py-1.5" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 4px)' }}>
      {keys.map((row, ri) => (
        <div key={ri} className="flex justify-center gap-1 mb-1">
          {row.map((key, ki) => {
            const isSpace = key === '␣';
            const isEnter = key === '↩';
            const isShiftKey = key === '⇧';
            const isBackspace = key === '⌫';
            const isSpecial = NO_REPEAT.has(key);
            const canRepeat = !isSpecial;
            const char = effectiveShift && SHIFT_MAP[key] ? SHIFT_MAP[key] : key;

            let cls = 'flex items-center justify-center rounded text-sm font-medium active:opacity-60 select-none cursor-pointer h-10';
            if (isSpace) cls += ' flex-[3] bg-[var(--vk-kb-special,#3a3a5e)] text-[var(--vk-kb-text,#ccc)]';
            else if (isEnter) cls += ' flex-[1.5] bg-[var(--color-accent-info)] text-white';
            else if (isShiftKey) cls += ` flex-1 ${capsLock ? 'bg-[var(--color-accent-success)] text-white' : effectiveShift ? 'bg-[var(--color-accent-info)] text-white' : 'bg-[var(--vk-kb-special,#3a3a5e)] text-[var(--vk-kb-text,#ccc)]'}`;
            else if (isBackspace) cls += ' flex-[1.2] bg-[var(--vk-kb-backspace,#5a2a2a)] text-[var(--vk-kb-backspace-text,#f88)]';
            else if (isSpecial) cls += ' flex-1 bg-[var(--vk-kb-special,#3a3a5e)] text-[var(--vk-kb-text-muted,#aaa)] text-xs';
            else cls += ' flex-1 bg-[var(--vk-kb-key,#4a4a6e)] text-[var(--vk-kb-text,#eee)]';

            return (
              <div key={ki} className={cls} role="button" tabIndex={-1}
                onTouchStart={e => { e.preventDefault(); e.stopPropagation(); handleTouchStart(key, char, isBackspace, canRepeat); }}
                onTouchEnd={() => { stopRepeat(); }}
                onTouchCancel={() => { stopRepeat(); }}
                onMouseDown={e => e.preventDefault()}
                onMouseUp={stopRepeat}
                onMouseLeave={stopRepeat}
              >{char}</div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
