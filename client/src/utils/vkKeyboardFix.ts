/**
 * VK WebView keyboard fix v14 — minimal: scrollIntoView nearest on focus.
 */

function isTextInput(el: HTMLElement): boolean {
  if (el.tagName === 'TEXTAREA') return true;
  if (el.tagName === 'INPUT') {
    const type = (el as HTMLInputElement).type;
    return !['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'image', 'hidden', 'range', 'color'].includes(type);
  }
  return el.isContentEditable;
}

export function initVkKeyboardFix() {
  document.addEventListener('focusin', (e: FocusEvent) => {
    const target = e.target as HTMLElement;
    if (!isTextInput(target)) return;

    [150, 350, 600].forEach(delay => {
      setTimeout(() => {
        target.scrollIntoView({ block: 'nearest', behavior: 'instant' });
      }, delay);
    });
  });
}
