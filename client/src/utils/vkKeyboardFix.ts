/**
 * VK WebView keyboard fix v15 — VKWebAppUpdateInsets listener.
 *
 * Subscribes to VK Bridge's insets update events (keyboard height).
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
  if (!window.vkBridge) return;

  // Debug: show insets in corner
  const debug = document.createElement('div');
  debug.style.cssText = `
    position: fixed; top: 40px; right: 5px; z-index: 99999;
    background: rgba(0,0,0,0.85); color: #0f0; font: 9px monospace;
    padding: 4px 6px; border-radius: 3px; pointer-events: none;
  `;
  document.body.appendChild(debug);

  let lastInsets = '';
  function updateDebug(msg: string) {
    lastInsets = msg;
    debug.textContent = 'insets: ' + msg;
  }

  // Method 1: vkBridge.subscribe (v3.x API)
  if (typeof window.vkBridge.subscribe === 'function') {
    updateDebug('subscribed');
    window.vkBridge.subscribe((e: any) => {
      const detail = e?.detail || e;
      if (detail?.type === 'VKWebAppUpdateInsets') {
        const b = detail?.data?.insets?.bottom || 0;
        updateDebug('bottom=' + b);
      }
    });
  } else {
    updateDebug('no subscribe()');
  }

  // Method 2: postMessage listener (fallback for older SDK)
  window.addEventListener('message', (e: MessageEvent) => {
    try {
      const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      if (data?.type === 'VKWebAppUpdateInsets') {
        const b = data?.data?.insets?.bottom || 0;
        updateDebug('postMsg bottom=' + b);
      }
    } catch {}
  });

  // Also try requesting insets (may trigger an event)
  window.vkBridge.send('VKWebAppGetConfig').catch(() => {});

  // Scroll input into view
  document.addEventListener('focusin', (e: FocusEvent) => {
    const target = e.target as HTMLElement;
    if (!isTextInput(target)) return;
    [200, 400, 600].forEach(d => {
      setTimeout(() => target.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), d);
    });
  });
}
