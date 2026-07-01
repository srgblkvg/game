/**
 * VK WebView keyboard fix.
 *
 * Problem: VK iframe has scrolling="no". CSS sets height:100dvh + overflow-y:auto on body.
 * When mobile keyboard opens, 100dvh shrinks, but body.scrollTop stays the same →
 * content is pushed up, empty space appears between top of viewport and content.
 *
 * Solution (combined):
 * 1. CSS: add position:relative + height:100% as base (less jumpy than pure dvh)
 * 2. JS: on visualViewport resize, compensate scrollTop by the same delta
 * 3. JS: on input focus, prevent browser auto-scroll, reposition manually
 */

let prevHeight = 0;
let focusedInput: HTMLElement | null = null;
let lockScroll = false;

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

function repositionInput() {
  if (!focusedInput) return;
  // Use scrollIntoView with nearest — minimal scroll, no overshoot
  focusedInput.scrollIntoView({ block: 'nearest', behavior: 'instant' });
}

function handleViewportResize() {
  const vv = window.visualViewport;
  if (!vv) return;

  const current = vv.height;
  if (prevHeight === 0) { prevHeight = current; return; }

  const diff = prevHeight - current;

  if (Math.abs(diff) > 10) {
    // Viewport changed significantly (keyboard opened/closed)
    // Compensate: add the height delta to scrollTop
    // If viewport shrunk by 300px: scrollTop += 300 (scroll down to keep content in place)
    // If viewport grew by 300px: scrollTop -= 300 (scroll up)
    document.body.scrollTop += diff;

    // Fine-tune input position
    if (focusedInput && diff > 10) {
      requestAnimationFrame(repositionInput);
    }
  }

  prevHeight = current;
}

export function initVkKeyboardFix() {
  if (!window.visualViewport) return;

  const vv = window.visualViewport;
  prevHeight = vv.height;

  // Monitor viewport changes (keyboard transitions)
  vv.addEventListener('resize', handleViewportResize);
  vv.addEventListener('scroll', handleViewportResize);

  // Track input focus — save scroll position to counteract browser auto-scroll
  document.addEventListener('focusin', (e: FocusEvent) => {
    const target = e.target as HTMLElement;
    if (!isTextInput(target)) return;

    focusedInput = target;
    const savedScroll = document.body.scrollTop;
    lockScroll = true;

    // Browser will auto-scroll to the input on next frame.
    // Restore the saved position, then manually position.
    requestAnimationFrame(() => {
      if (lockScroll) {
        document.body.scrollTop = savedScroll;
        requestAnimationFrame(() => {
          target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        });
      }
    });
  });

  document.addEventListener('focusout', (e: FocusEvent) => {
    const target = e.target as HTMLElement;
    if (!isTextInput(target)) return;
    if (focusedInput === target) {
      focusedInput = null;
      lockScroll = false;
    }
  });
}
