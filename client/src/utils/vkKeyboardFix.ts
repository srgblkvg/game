/**
 * VK WebView keyboard fix.
 *
 * Diagnosis: viewport/iframe resize from 846→224 when keyboard opens.
 * Browser auto-scrolls on focus, causing overscroll → empty space.
 *
 * Fix: freeze scroll (overflow:hidden) on focus, preventing visual movement.
 * After keyboard settles, restore scroll and position input manually.
 */

function getScrollEl(): HTMLElement {
  return document.getElementById('root') || document.body;
}

function isTextInput(el: HTMLElement): boolean {
  if (el.tagName === 'TEXTAREA') return true;
  if (el.tagName === 'INPUT') {
    const type = (el as HTMLInputElement).type;
    return type === 'text' || type === 'search' || type === 'number'
      || type === 'email' || type === 'url' || type === 'tel'
      || type === 'password' || type === '';
  }
  return el.isContentEditable;
}

let lockedInput: HTMLElement | null = null;
let frozen = false;

function freeze() {
  const el = getScrollEl();
  el.style.overflow = 'hidden';
  frozen = true;
}

function unfreeze() {
  const el = getScrollEl();
  frozen = false;

  if (lockedInput) {
    // Scroll input into view BEFORE re-enabling overflow (no visual jump)
    const vv = window.visualViewport;
    const vh = vv ? vv.height : window.innerHeight;
    const rect = lockedInput.getBoundingClientRect();
    const maxScroll = Math.max(0, el.scrollHeight - vh);

    if (rect.bottom > vh - 20) {
      el.scrollTop += (rect.bottom - vh) + 40;
    }
    // Clamp
    if (el.scrollTop > maxScroll) el.scrollTop = maxScroll;
  }

  el.style.overflow = '';
}

export function initVkKeyboardFix() {
  // Focus: freeze scroll immediately
  document.addEventListener('focusin', (e: FocusEvent) => {
    const target = e.target as HTMLElement;
    if (!isTextInput(target)) return;
    lockedInput = target;
    freeze();

    // Unfreeze after keyboard settles
    setTimeout(unfreeze, 400);
  });

  // Viewport resize while frozen: keep frozen, just track
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
      if (frozen && lockedInput) {
        // Re-clamp + reposition while still frozen
        setTimeout(unfreeze, 100);
      }
    });
  }

  // Blur: unfreeze if needed
  document.addEventListener('focusout', (e: FocusEvent) => {
    const target = e.target as HTMLElement;
    if (!isTextInput(target)) return;

    setTimeout(() => {
      const active = document.activeElement as HTMLElement | null;
      if (active && isTextInput(active)) {
        lockedInput = active;
        return;
      }
      lockedInput = null;
      if (frozen) unfreeze();
    }, 200);
  });
}
