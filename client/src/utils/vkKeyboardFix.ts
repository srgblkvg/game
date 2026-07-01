/**
 * VK WebView keyboard fix.
 *
 * CSS: html/body overflow:hidden, #root overflow-y:auto.
 * JS: rAF loop sets html/body/#root heights to visualViewport.height.
 * When keyboard opens (viewport shrinks), heights update in sync → no empty space.
 */

let rafId = 0;
let lockedInput: HTMLElement | null = null;

function getScrollEl(): HTMLElement {
  return document.getElementById('root') || document.body;
}

function isTextInput(el: HTMLElement): boolean {
  if (el.tagName === 'TEXTAREA') return true;
  if (el.tagName === 'INPUT') {
    const type = (el as HTMLInputElement).type;
    return !['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'image', 'hidden', 'range', 'color'].includes(type);
  }
  return el.isContentEditable;
}

function syncHeights() {
  const vv = window.visualViewport;
  if (!vv) return;

  const h = Math.round(vv.height);

  // Set fixed heights — no CSS positioning, just pixel heights
  document.documentElement.style.height = h + 'px';
  document.body.style.height = h + 'px';

  const root = document.getElementById('root');
  if (root) {
    root.style.height = h + 'px';
  }

  // Ensure input is visible within the viewport
  if (lockedInput) {
    const scrollEl = getScrollEl();
    const rect = lockedInput.getBoundingClientRect();
    if (rect.bottom > h - 20) {
      scrollEl.scrollTop += (rect.bottom - h) + 40;
    }
    // Clamp
    const maxScroll = Math.max(0, scrollEl.scrollHeight - h);
    if (scrollEl.scrollTop > maxScroll) scrollEl.scrollTop = maxScroll;
  }
}

function startLoop() {
  if (rafId) return;
  syncHeights();
  function loop() {
    syncHeights();
    rafId = requestAnimationFrame(loop);
  }
  rafId = requestAnimationFrame(loop);
}

function stopLoop() {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
  // Restore natural heights (100dvh from CSS)
  document.documentElement.style.height = '';
  document.body.style.height = '';
  const root = document.getElementById('root');
  if (root) root.style.height = '';
}

export function initVkKeyboardFix() {
  if (!window.visualViewport) return;

  document.addEventListener('focusin', (e: FocusEvent) => {
    const target = e.target as HTMLElement;
    if (!isTextInput(target)) return;
    lockedInput = target;
    startLoop();
  });

  document.addEventListener('focusout', (e: FocusEvent) => {
    const target = e.target as HTMLElement;
    if (!isTextInput(target)) return;
    setTimeout(() => {
      const active = document.activeElement as HTMLElement | null;
      if (active && isTextInput(active)) {
        lockedInput = active;
        return;
      }
      lockedInput = null;
      stopLoop();
    }, 300);
  });
}
