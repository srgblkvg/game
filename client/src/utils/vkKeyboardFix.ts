/**
 * VK WebView keyboard fix.
 *
 * Primary fix: meta viewport interactive-widget=overlays-content.
 * If supported, viewport does NOT resize on keyboard → no empty space.
 *
 * Fallback (JS): if viewport still resizes, clamp scrollTop + scroll input into view.
 */

let lockedInput: HTMLElement | null = null;
let prevHeight = 0;

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

function scrollToInput() {
  if (!lockedInput) return;
  const scrollEl = getScrollEl();
  const vv = window.visualViewport;
  const vh = vv ? vv.height : window.innerHeight;
  const rect = lockedInput.getBoundingClientRect();

  if (rect.bottom > vh - 20) {
    scrollEl.scrollTop += (rect.bottom - vh) + 50;
  }

  // Clamp — no overscroll
  const maxScroll = Math.max(0, scrollEl.scrollHeight - vh);
  if (scrollEl.scrollTop > maxScroll) {
    scrollEl.scrollTop = maxScroll;
  }
}

function handleResize() {
  const vv = window.visualViewport;
  if (!vv) return;
  const h = vv.height;

  // Only react to significant resize (>50px)
  if (prevHeight > 0 && Math.abs(h - prevHeight) > 50 && lockedInput) {
    scrollToInput();
  }
  prevHeight = h;
}

export function initVkKeyboardFix() {
  if (window.visualViewport) {
    prevHeight = window.visualViewport.height;
    window.visualViewport.addEventListener('resize', handleResize);
  }

  document.addEventListener('focusin', (e: FocusEvent) => {
    const target = e.target as HTMLElement;
    if (!isTextInput(target)) return;
    lockedInput = target;
    setTimeout(scrollToInput, 350);
  });

  document.addEventListener('focusout', (e: FocusEvent) => {
    const target = e.target as HTMLElement;
    if (!isTextInput(target)) return;
    setTimeout(() => {
      if (document.activeElement && isTextInput(document.activeElement as HTMLElement)) {
        lockedInput = document.activeElement as HTMLElement;
        return;
      }
      lockedInput = null;
    }, 200);
  });
}
