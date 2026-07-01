/**
 * VK WebView keyboard fix.
 *
 * CSS: html+body are position:fixed/absolute (never scroll), #root is the scroll container.
 * This isolates scrolling from the WebView — when keyboard pushes the viewport,
 * the containers stay locked to viewport edges.
 *
 * JS: on input focus, lock scroll position and adjust if keyboard covers the input.
 */

let lockedScrollY = 0;
let lockedInput: HTMLElement | null = null;

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

function lock() {
  const scrollEl = getScrollEl();
  lockedScrollY = scrollEl.scrollTop;
  // Prevent any OS-level scroll from affecting visual position
  scrollEl.style.overflow = 'hidden';
}

function unlock() {
  const scrollEl = getScrollEl();
  scrollEl.style.overflow = '';
}

function adjustForKeyboard() {
  if (!lockedInput || !window.visualViewport) return;

  const vv = window.visualViewport;
  const inputRect = lockedInput.getBoundingClientRect();
  const inputBottom = inputRect.bottom;
  const vvHeight = vv.height;

  // Input hidden behind keyboard — scroll root to reveal it
  if (inputBottom > vvHeight - 10) {
    const scrollEl = getScrollEl();
    const offset = inputBottom - vvHeight + 30; // 30px margin
    scrollEl.scrollTop = lockedScrollY + offset;
  }
}

export function initVkKeyboardFix() {
  if (!window.visualViewport) return;

  // Lock on text input focus
  document.addEventListener('focusin', (e: FocusEvent) => {
    const target = e.target as HTMLElement;
    if (!isTextInput(target)) return;

    lockedInput = target;
    lock();

    // Wait for keyboard to appear, then adjust
    setTimeout(adjustForKeyboard, 350);
  });

  // Viewport resize (keyboard appearing/disappearing) while locked
  window.visualViewport.addEventListener('resize', () => {
    if (lockedInput) {
      adjustForKeyboard();
    }
  });

  // Unlock on text input blur
  document.addEventListener('focusout', (e: FocusEvent) => {
    const target = e.target as HTMLElement;
    if (!isTextInput(target)) return;

    setTimeout(() => {
      const active = document.activeElement as HTMLElement | null;
      if (active && isTextInput(active)) {
        // Focus moved to another input — re-lock for new target
        lockedInput = active;
        lock();
        setTimeout(adjustForKeyboard, 100);
        return;
      }

      // No text input focused — unlock
      lockedInput = null;
      unlock();
    }, 150);
  });
}
