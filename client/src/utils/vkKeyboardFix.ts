/**
 * VK WebView keyboard fix v13.
 *
 * Diagnosis confirmed: bodyH now follows vv.h (224) when keyboard opens.
 * Body no longer 1681px — container is correct.
 *
 * Remaining fix: also clamp html height, and ensure input is scrollable.
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
  function sync() {
    if (!window.visualViewport) return;
    const h = Math.round(window.visualViewport.height);
    const px = h + 'px';

    // Clamp html — prevents any overflow outside viewport
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.height = px;
    document.documentElement.style.minHeight = px;

    // Body = scroll container, matches viewport
    document.body.style.height = px;
    document.body.style.minHeight = px;
    document.body.style.overflowY = 'auto';
    document.body.style.position = 'relative';
  }

  sync();
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', sync);
  }

  // Focus: scroll input into view after keyboard
  document.addEventListener('focusin', (e: FocusEvent) => {
    const target = e.target as HTMLElement;
    if (!isTextInput(target)) return;

    sync();

    // Multiple attempts to scroll — race condition with keyboard animation
    [300, 500, 700].forEach(delay => {
      setTimeout(() => {
        const vv = window.visualViewport;
        if (!vv) return;
        const rect = target.getBoundingClientRect();
        if (rect.bottom > vv.height - 10) {
          document.body.scrollTop += (rect.bottom - vv.height) + 30;
        }
        const maxS = Math.max(0, document.body.scrollHeight - vv.height);
        if (document.body.scrollTop > maxS) {
          document.body.scrollTop = maxS;
        }
      }, delay);
    });
  });
}
