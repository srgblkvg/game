/**
 * VK WebView keyboard fix.
 *
 * Problem: VK iframe has scrolling="no". CSS sets height:100dvh + overflow-y:auto on body.
 * When mobile keyboard appears, 100dvh shrinks but scroll position stays —
 * top content is scrolled out, leaving empty background above keyboard.
 *
 * Solution: use visualViewport API.
 * - On input focus: listen for viewport resize, adjust scroll to keep input visible
 * - On keyboard close: restore normal state
 * - Use requestAnimationFrame to avoid layout thrashing
 */

let keyboardOpen = false;
let lastHeight = 0;

function isTextInput(el: HTMLElement): boolean {
  if (el.tagName === 'TEXTAREA') return true;
  if (el.tagName === 'INPUT') {
    const type = (el as HTMLInputElement).type;
    return type === 'text' || type === 'search' || type === 'number' || type === 'email' || type === 'url' || type === 'tel' || type === 'password' || type === '';
  }
  return el.isContentEditable;
}

function handleViewportResize() {
  if (!window.visualViewport) return;
  const vv = window.visualViewport;
  const currentHeight = vv.height;
  const activeEl = document.activeElement as HTMLElement | null;

  // Keyboard opened: viewport shrunk
  if (lastHeight > 0 && currentHeight < lastHeight - 50 && activeEl && isTextInput(activeEl)) {
    keyboardOpen = true;
    // Keep the input visible within the new viewport
    requestAnimationFrame(() => {
      activeEl.scrollIntoView({ block: 'center', behavior: 'instant' });
    });
  }

  // Keyboard closed: viewport restored
  if (keyboardOpen && currentHeight > lastHeight + 50) {
    keyboardOpen = false;
    // Restore normal scroll — let the browser handle it
    requestAnimationFrame(() => {
      // Don't scroll back up — just let the layout restore naturally
      // The body height is still 100dvh, which will update automatically
    });
  }

  lastHeight = currentHeight;
}

export function initVkKeyboardFix() {
  if (!window.visualViewport) return;

  const vv = window.visualViewport;
  // Track initial viewport height
  lastHeight = vv.height;

  // Monitor viewport changes (keyboard open/close)
  vv.addEventListener('resize', handleViewportResize);
  // Also monitor scroll (some browsers fire scroll instead of resize)
  vv.addEventListener('scroll', handleViewportResize);

  // Also scroll focused input into view on focus
  document.addEventListener('focusin', (e: FocusEvent) => {
    const target = e.target as HTMLElement;
    if (!isTextInput(target)) return;

    // Wait for keyboard to start appearing, then scroll
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        target.scrollIntoView({ block: 'center', behavior: 'smooth' });
      });
    });
  });
}
