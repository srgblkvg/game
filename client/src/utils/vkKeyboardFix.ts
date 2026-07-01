/**
 * VK WebView keyboard workaround.
 *
 * Can't prevent the WebView shift, so we make it harmless:
 * on input focus, scroll it to the very TOP of the viewport.
 * Also force body height to visualViewport.height.
 *
 * Scoped to html.vk-iframe only — does NOT affect regular site.
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
  function syncHeight() {
    if (!window.visualViewport) return;
    const h = Math.round(window.visualViewport.height);
    document.body.style.minHeight = h + 'px';
    document.body.style.height = h + 'px';
  }

  syncHeight();
  window.visualViewport?.addEventListener('resize', syncHeight);

  document.addEventListener('focusin', (e: FocusEvent) => {
    const target = e.target as HTMLElement;
    if (!isTextInput(target)) return;

    syncHeight();

    // Scroll input to TOP of viewport — keyboard will appear below it
    [150, 350, 600].forEach(delay => {
      setTimeout(() => {
        target.scrollIntoView({ block: 'start', behavior: 'instant' });
        // Clamp scroll to prevent overscroll
        const maxS = Math.max(0, document.body.scrollHeight - (window.visualViewport?.height || window.innerHeight));
        if (document.body.scrollTop > maxS) document.body.scrollTop = maxS;
      }, delay);
    });
  });
}
