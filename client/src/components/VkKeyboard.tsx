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

function isTextInput(el: HTMLElement): boolean {
  if (el.tagName === 'TEXTAREA') return true;
  if (el.tagName === 'INPUT') {
    const type = (el as HTMLInputElement).type;
    return !['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'image', 'hidden', 'range', 'color'].includes(type);
  }
  return el.isContentEditable;
}

function insertText(el: HTMLInputElement | HTMLTextAreaElement, text: string) {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  el.setRangeText(text, start, end, 'end');
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.focus();
}

export default function VkKeyboard() {
  const [layout, setLayout] = useState<Layout>('ru');
  const [shift, setShift] = useState(false);
  const [active, setActive] = useState<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const kbRef = useRef<HTMLDivElement>(null);
  const backspaceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Only render in VK WebView (mobile iframe)
  if (typeof document !== 'undefined' && !document.documentElement.classList.contains('vk-iframe')) {
    return null;
  }

  // Long-press backspace: first delete immediately, wait 200ms, then repeat
  const startBackspace = useCallback(() => {
    if (!active) return;
    const input = active; // capture
    // First delete immediately
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    if (start !== end) {
      insertText(input, '');
    } else if (start > 0) {
      input.setSelectionRange(start - 1, start);
      insertText(input, '');
    }
    // Wait 200ms before starting repeat
    backspaceTimer.current = setTimeout(() => {
      // Check still active after delay
      if (!active || active !== input) return;
      backspaceTimer.current = setInterval(() => {
        if (!active) { stopBackspace(); return; }
        const s = active.selectionStart ?? active.value.length;
        const e = active.selectionEnd ?? active.value.length;
        if (s !== e) {
          insertText(active, '');
        } else if (s > 0) {
          active.setSelectionRange(s - 1, s);
          insertText(active, '');
        } else {
          stopBackspace();
        }
      }, 50);
    }, 200);
  }, [active]);

  const stopBackspace = useCallback(() => {
    if (backspaceTimer.current) {
      clearInterval(backspaceTimer.current);
      backspaceTimer.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => () => stopBackspace(), [stopBackspace]);
  // Notify body about keyboard height → chat panel adjusts
  useLayoutEffect(() => {
    if (active && kbRef.current) {
      const h = kbRef.current.offsetHeight;
      document.body.style.setProperty('--vk-keyboard-height', h + 'px');
    } else {
      document.body.style.removeProperty('--vk-keyboard-height');
    }
    return () => {
      document.body.style.removeProperty('--vk-keyboard-height');
    };
  }, [active]);

  // Re-measure on layout state change (changes number of rows)
  useEffect(() => {
    if (active && kbRef.current) {
      document.body.style.setProperty('--vk-keyboard-height', kbRef.current.offsetHeight + 'px');
    }
  }, [layout, active]);

  // Track active input
  useEffect(() => {
    const onFocus = (e: FocusEvent) => {
      const el = e.target as HTMLElement;
      if (isTextInput(el)) {
        setActive(el as HTMLInputElement | HTMLTextAreaElement);
      }
    };
    const onBlur = () => {
      requestAnimationFrame(() => {
        const ae = document.activeElement as HTMLElement | null;
        if (!ae || !isTextInput(ae)) {
          setActive(null);
        }
      });
    };

    document.addEventListener('focusin', onFocus);
    document.addEventListener('focusout', onBlur);
    return () => {
      document.removeEventListener('focusin', onFocus);
      document.removeEventListener('focusout', onBlur);
    };
  }, []);

  const handleKey = useCallback((key: string) => {
    if (!active) return;

    if (key === '⌫') {
      const start = active.selectionStart ?? active.value.length;
      const end = active.selectionEnd ?? active.value.length;
      if (start !== end) {
        insertText(active, '');
      } else if (start > 0) {
        active.setSelectionRange(start - 1, start);
        insertText(active, '');
      }
    } else if (key === '␣') {
      insertText(active, ' ');
    } else if (key === '↩') {
      if (active.tagName === 'INPUT' && (active as HTMLInputElement).type !== 'textarea') {
        active.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      } else {
        insertText(active, '\n');
      }
    } else if (key === '⇧') {
      setShift(s => !s);
    } else if (key === '123') {
      setLayout('num'); setShift(false);
    } else if (key === 'en') {
      setLayout('en'); setShift(false);
    } else if (key === 'ru') {
      setLayout('ru'); setShift(false);
    } else if (key === 'abc') {
      setLayout('en'); setShift(false);
    } else {
      const char = shift && SHIFT_MAP[key] ? SHIFT_MAP[key] : key;
      insertText(active, char);
      if (shift) setShift(false);
    }
  }, [active, shift]);

  if (!active) return null;

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
            const isSpecial = ['⌫', '⇧', '123', 'en', 'ru', 'abc', '␣', '↩'].includes(key);

            let cls = 'flex items-center justify-center rounded text-sm font-medium active:opacity-60 transition-opacity select-none';
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

            return (
              <button
                key={ki}
                className={cls}
                onMouseDown={e => e.preventDefault()}
                onTouchStart={e => {
                  e.preventDefault();
                  if (isBackspace) {
                    startBackspace();
                  } else {
                    handleKey(key);
                  }
                }}
                onTouchEnd={() => {
                  if (isBackspace) stopBackspace();
                }}
                onTouchCancel={() => {
                  if (isBackspace) stopBackspace();
                }}
                onMouseUp={() => {
                  if (isBackspace) stopBackspace();
                }}
                onMouseLeave={() => {
                  if (isBackspace) stopBackspace();
                }}
              >
                {display}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
