/**
 * VK WebView keyboard fix.
 *
 * Problem: VK WebView pushes the iframe up when mobile keyboard opens,
 * leaving empty space. CSS/JS inside the page can't prevent this.
 *
 * Solution: use VKWebAppResizeWindow to shrink iframe to visualViewport.
 * CSS uses position:fixed (no vh dependency) → no infinite resize loop.
 */

let lockedInput: HTMLElement | null = null;
let originalHeight = 0;
let originalWidth = 0;
let lastResizeTime = 0;

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

function resizeIframe(width: number, height: number) {
  if (!window.vkBridge) return;

  // Debounce: max 1 resize per 500ms to prevent loops
  const now = Date.now();
  if (now - lastResizeTime < 500) return;
  lastResizeTime = now;

  window.vkBridge.send('VKWebAppResizeWindow', {
    width: Math.round(width),
    height: Math.round(height),
  }).catch(() => {});
}

function scrollInputIntoView() {
  if (!lockedInput) return;
  const scrollEl = getScrollEl();
  const inputRect = lockedInput.getBoundingClientRect();
  const inputBottom = inputRect.bottom;
  const vvHeight = window.visualViewport
    ? window.visualViewport.height
    : window.innerHeight;

  // If input is hidden behind keyboard, scroll it up
  if (inputBottom > vvHeight - 20) {
    const offset = inputBottom - vvHeight + 40;
    scrollEl.scrollTop += offset;
  }
}

export function initVkKeyboardFix() {
  if (!window.vkBridge || !window.visualViewport) return;

  originalWidth = window.innerWidth;
  originalHeight = window.innerHeight;

  // Focus: shrink iframe to visual viewport (eliminates gap above keyboard)
  document.addEventListener('focusin', (e: FocusEvent) => {
    const target = e.target as HTMLElement;
    if (!isTextInput(target)) return;

    lockedInput = target;
    const vv = window.visualViewport!;
    resizeIframe(vv.width, vv.height);

    // Scroll after keyboard settles
    setTimeout(scrollInputIntoView, 350);
  });

  // Viewport resize while input is focused → just scroll (don't resize again)
  window.visualViewport.addEventListener('resize', () => {
    if (lockedInput) {
      scrollInputIntoView();
    }
  });

  // Blur: restore original iframe size
  document.addEventListener('focusout', (e: FocusEvent) => {
    const target = e.target as HTMLElement;
    if (!isTextInput(target)) return;

    setTimeout(() => {
      const active = document.activeElement as HTMLElement | null;
      if (active && isTextInput(active)) {
        // Focus moved to another input
        lockedInput = active;
        scrollInputIntoView();
        return;
      }

      // No input focused — restore iframe size
      lockedInput = null;
      lastResizeTime = 0; // allow immediate resize
      resizeIframe(originalWidth, originalHeight);
    }, 200);
  });
}
