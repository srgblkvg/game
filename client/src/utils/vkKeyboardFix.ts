/**
 * VK WebView keyboard fix.
 *
 * Diagnosis: body.offsetHeight stays at 1681px (content height) even when
 * viewport shrinks to 224px. CSS height:100dvh is NOT constraining body.
 * 
 * Fix: force body height via JS to match visualViewport.height.
 */

function isTextInput(el: HTMLElement): boolean {
  if (el.tagName === 'TEXTAREA') return true;
  if (el.tagName === 'INPUT') {
    const type = (el as HTMLInputElement).type;
    return !['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'image', 'hidden', 'range', 'color'].includes(type);
  }
  return el.isContentEditable;
}

function syncHeight() {
  if (!window.visualViewport) return;
  const h = window.visualViewport.height;
  document.body.style.height = h + 'px';
}

let wasResized = false;

export function initVkKeyboardFix() {
  if (!window.visualViewport) return;

  // Initial height sync
  syncHeight();

  // Sync on viewport resize (keyboard open/close)
  window.visualViewport.addEventListener('resize', () => {
    wasResized = true;
    syncHeight();
  });

  // On input focus, ensure height is correct and input is visible
  document.addEventListener('focusin', (e: FocusEvent) => {
    const target = e.target as HTMLElement;
    if (!isTextInput(target)) return;

    syncHeight();

    // Scroll input into view after keyboard settles
    setTimeout(() => {
      const vv = window.visualViewport!;
      const rect = target.getBoundingClientRect();
      if (rect.bottom > vv.height - 20) {
        document.body.scrollTop += (rect.bottom - vv.height) + 40;
      }
      // Clamp
      const maxScroll = Math.max(0, document.body.scrollHeight - vv.height);
      if (document.body.scrollTop > maxScroll) {
        document.body.scrollTop = maxScroll;
      }
    }, 350);
  });

  // On blur, if viewport was resized, restore full height
  document.addEventListener('focusout', (e: FocusEvent) => {
    const target = e.target as HTMLElement;
    if (!isTextInput(target)) return;

    setTimeout(() => {
      if (document.activeElement && isTextInput(document.activeElement as HTMLElement)) {
        return;
      }
      if (wasResized) {
        syncHeight(); // restore to full height
        wasResized = false;
      }
    }, 300);
  });
}
