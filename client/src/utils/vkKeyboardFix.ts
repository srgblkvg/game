/**
 * VK WebView keyboard diagnostic + fix.
 * Shows viewport/scroll data INLINE, forces body min-height to vv.height.
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
  // Diagnostic overlay
  const debug = document.createElement('div');
  debug.id = 'vk-debug';
  debug.style.cssText = `
    position: fixed; top: 5px; right: 5px; z-index: 99999;
    background: rgba(0,0,0,0.9); color: #0f0; font: 9px monospace;
    padding: 5px 7px; border-radius: 4px; max-width: 250px;
    pointer-events: none; line-height: 1.3;
  `;
  document.body.appendChild(debug);

  function update() {
    const vv = window.visualViewport;
    const body = document.body;
    const active = document.activeElement as HTMLElement | null;
    const isInp = active && isTextInput(active);

    debug.textContent = [
      `vv.h:  ${vv ? Math.round(vv.height) : '-'}`,
      `winH:  ${window.innerHeight}`,
      `bodyH: ${body.offsetHeight}`,
      `body.mH:${body.style.minHeight || 'css'}`,
      `b.scT: ${body.scrollTop}`,
      `b.scH: ${body.scrollHeight}`,
      `focus: ${active?.tagName || '-'}${isInp ? ' txt' : ''}`,
    ].join('\n');
  }

  // Force body height to visualViewport
  function sync() {
    if (!window.visualViewport) return;
    const h = Math.round(window.visualViewport.height);
    document.body.style.minHeight = h + 'px';
    document.body.style.height = h + 'px';
    update();
  }

  sync();
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', sync);
  }

  // Scroll input into view on focus
  document.addEventListener('focusin', (e: FocusEvent) => {
    const target = e.target as HTMLElement;
    if (!isTextInput(target)) return;

    sync();
    setTimeout(() => {
      sync();
      const vv = window.visualViewport!;
      const rect = target.getBoundingClientRect();
      if (rect.bottom > vv.height - 20) {
        document.body.scrollTop += (rect.bottom - vv.height) + 40;
      }
      const maxS = Math.max(0, document.body.scrollHeight - vv.height);
      if (document.body.scrollTop > maxS) document.body.scrollTop = maxS;
    }, 400);
  });

  setInterval(update, 300);
}
