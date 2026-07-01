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

// Keys that should NOT repeat on long-press
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
  const [active, setActive] = useState<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const kbRef = useRef<HTMLDivElement>(null);
  const repeatTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeatKey = useRef<string | null>(null);

  // Only render in VK mobile app WebView (not m.vk.com, not desktop)
  const isVKWebView = typeof document !== 'undefined'
    && document.documentElement.classList.contains('vk-iframe')
    && typeof window.vkBridge?.isWebView === 'function'
    && window.vkBridge.isWebView();

  // Stop repeat on cleanup
  const stopRepeat = useCallback(() => {
    if (repeatTimer.current) {
      clearTimeout(repeatTimer.current);
      repeatTimer.current = null;
    }
    repeatKey.current = null;
  }, []);

  useEffect(() => () => stopRepeat(), [stopRepeat]);

  // Start long-press repeat: immediately, then after delay, every 50ms
  const startRepeat = useCallback((key: string, char: string) => {
    if (!active) return;
    const input = active;

    // Insert first character immediately
    insertChar(input, char);
    if (shift) setShift(false);

    // After delay, start repeating
    repeatKey.current = key;
    repeatTimer.current = setTimeout(() => {
      repeatTimer.current = setInterval(() => {
        if (!active || repeatKey.current !== key) {
          stopRepeat();
          return;
        }
        insertChar(input, char);
      }, 50);
    }, 600);
  }, [active, shift, stopRepeat]);

  // Backspace long-press: same timing, different action
  const startBackspace = useCallback(() => {
    if (!active) return;
    const input = active;
    deleteChar(input);

    // Don't repeat if there's nothing to delete
    const s = input.selectionStart ?? input.value.length;
    const e = input.selectionEnd ?? input.value.length;
    if (s === 0 && e === 0) return;

    repeatTimer.current = setTimeout(() => {
      repeatTimer.current = setInterval(() => {
        if (!active) { stopRepeat(); return; }
        const start = input.selectionStart ?? input.value.length;
        const end = input.selectionEnd ?? input.value.length;
        if (start === 0 && end === 0) { stopRepeat(); return; }
        deleteChar(input);
      }, 50);
    }, 600);
  }, [active, stopRepeat]);

  // Notify body about keyboard height → chat panel adjusts
  useLayoutEffect(() => {
    if (active && kbRef.current) {
      document.body.style.setProperty('--vk-keyboard-height', kbRef.current.offsetHeight + 'px');
    } else {
      document.body.style.removeProperty('--vk-keyboard-height');
    }
    return () => document.body.style.removeProperty('--vk-keyboard-height');
  }, [active]);

  // Re-measure on layout change
  useEffect(() => {
    if (active && kbRef.current) {
      document.body.style.setProperty('--vk-keyboard-height', kbRef.current.offsetHeight + 'px');
    }
  }, [layout, active]);

  // Track active input — show on focus, hide only when tapping outside
  useEffect(() => {
    const onFocus = (e: FocusEvent) => {
      const el = e.target as HTMLElement;
      if (isTextInput(el)) setActive(el as HTMLInputElement | HTMLTextAreaElement);
    };

    // Hide keyboard only when tapping outside any input AND outside keyboard
    const onTap = (e: Event) => {
      const target = e.target as HTMLElement;
      if (isTextInput(target)) return;
      if (target.closest('.vk-keyboard')) return;
      setActive(null);
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

  const handleKey = useCallback((key: string) => {
    if (!active) return;

    if (key === '⌫') {
      deleteChar(active);
    } else if (key === '␣') {
      insertChar(active, ' ');
    } else if (key === '↩') {
      if (active.tagName === 'INPUT') {
        active.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      } else {
        insertChar(active, '\n');
      }
    } else if (key === '⇧') {
      setShift(s => !s);
    } else if (key === '123') { setLayout('num'); setShift(false); }
    else if (key === 'en')  { setLayout('en');  setShift(false); }
    else if (key === 'ru')  { setLayout('ru');  setShift(false); }
    else if (key === 'abc') { setLayout('en');  setShift(false); }
    else {
      const char = shift && SHIFT_MAP[key] ? SHIFT_MAP[key] : key;
      insertChar(active, char);
      if (shift) setShift(false);
    }
  }, [active, shift]);

  if (!isVKWebView || !active) return null;

  const keys = LAYOUTS[layout];

  return (
    <div
      ref={kbRef}
      className="vk-keyboard fixed bottom-0 left-0 right-0 z-[10000] select-none
                 bg-[var(--vk-kb-bg,#1a1a2e)] border-t border-[var(--vk-kb-border,#333)]
                 px-1 py-1.5"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 4px)' }}
    >
      {keys.map((row, ri) => (
        <div key={ri} className="flex justify-center gap-1 mb-1">
          {row.map((key, ki) => {
            const isSpace = key === '␣';
            const isEnter = key === '↩';
            const isShift = key === '⇧';
            const isBackspace = key === '⌫';
            const isSpecial = NO_REPEAT.has(key);
            const canRepeat = !isSpecial; // character keys can long-press repeat

            let cls = 'flex items-center justify-center rounded text-sm font-medium active:opacity-60 transition-opacity select-none cursor-pointer';
            if (isSpace) {
              cls += ' flex-[3] bg-[var(--vk-kb-special,#3a3a5e)] text-[var(--vk-kb-text,#ccc)] h-10';
            } else if (isEnter) {
              cls += ' flex-[1.5] bg-[var(--color-accent-info)] text-white h-10';
            } else if (isShift) {
              cls += ` flex-1 ${shift ? 'bg-[var(--color-accent-info)] text-white' : 'bg-[var(--vk-kb-special,#3a3a5e)] text-[var(--vk-kb-text,#ccc)]'} h-10`;
            } else if (isBackspace) {
              cls += ' flex-[1.2] bg-[var(--vk-kb-backspace,#5a2a2a)] text-[var(--vk-kb-backspace-text,#f88)] h-10';
            } else if (isSpecial) {
              cls += ' flex-1 bg-[var(--vk-kb-special,#3a3a5e)] text-[var(--vk-kb-text-muted,#aaa)] h-10 text-xs';
            } else {
              cls += ' flex-1 bg-[var(--vk-kb-key,#4a4a6e)] text-[var(--vk-kb-text,#eee)] h-10';
            }

            const display = shift && SHIFT_MAP[key] ? SHIFT_MAP[key] : key;
            const char = shift && SHIFT_MAP[key] ? SHIFT_MAP[key] : key;

            return (
              <div
                key={ki}
                className={cls}
                role="button"
                tabIndex={-1}
                onMouseDown={e => e.preventDefault()}
                onTouchStart={e => {
                  e.preventDefault();
                  if (isBackspace) {
                    startBackspace();
                  } else if (canRepeat) {
                    startRepeat(key, char);
                  } else {
                    handleKey(key);
                  }
                }}
                onTouchEnd={stopRepeat}
                onTouchCancel={stopRepeat}
                onMouseUp={stopRepeat}
                onMouseLeave={stopRepeat}
              >
                {display}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
