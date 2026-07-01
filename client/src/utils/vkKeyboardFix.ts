/**
 * VK WebView keyboard fix.
 *
 * Diagnosis: CSS height/min-height is ignored or overridden in VK WebView.
 * Base CSS has html,body,#root { min-height: 100vh } forcing content-size height.
 *
 * Fix: force height + minHeight on html, body, AND #root via JS inline styles
 * (inline style > CSS). This ensures containers match visualViewport exactly.
 */

function isTextInput(el: HTMLElement): boolean {
  if (el.tagName === 'TEXTAREA') return true;
  if (el.tagName === 'INPUT') {
    const type = (el as HTMLInputElement).type;
    return !['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'image', 'hidden', 'range', 'color'].includes(type);
  }
  return el.isContentEditable;
}

function syncHeight(h?: number) {
  const vh = h ?? (window.visualViewport ? window.visualViewport.height : window.innerHeight);
  const px = Math.round(vh) + 'px';

  document.documentElement.style.height = px;
  document.documentElement.style.minHeight = px;
  document.body.style.height = px;
  document.body.style.minHeight = px;

  const root = document.getElementById('root');
  if (root) {
    root.style.minHeight = px;
    root.style.height = px;
  }
}

export function initVkKeyboardFix() {
  syncHeight();

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => syncHeight());
  }
  window.addEventListener('resize', () => syncHeight());

  document.addEventListener('focusin', (e: FocusEvent) => {
    const target = e.target as HTMLElement;
    if (!isTextInput(target)) return;

    syncHeight();

    setTimeout(() => {
      syncHeight();
      const vv = window.visualViewport;
      const vh = vv ? vv.height : window.innerHeight;
      const rect = target.getBoundingClientRect();

      if (rect.bottom > vh - 20) {
        document.body.scrollTop += (rect.bottom - vh) + 40;
      }
      const maxScroll = Math.max(0, document.body.scrollHeight - vh);
      if (document.body.scrollTop > maxScroll) {
        document.body.scrollTop = maxScroll;
      }
    }, 400);
  });
}
