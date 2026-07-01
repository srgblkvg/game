/**
 * VK WebView keyboard workaround.
 *
 * Uses visualViewport API with rAF loop to sync body height in real-time.
 * Standard workaround for WebView keyboard issues.
 */

let rafId = 0;
let lockedInput: HTMLElement | null = null;

function isTextInput(el: HTMLElement): boolean {
  if (el.tagName === 'TEXTAREA') return true;
  if (el.tagName === 'INPUT') {
    const type = (el as HTMLInputElement).type;
    return !['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'image', 'hidden', 'range', 'color'].includes(type);
  }
  return el.isContentEditable;
}

function sync() {
  const vv = window.visualViewport;
  if (!vv) return;

  const h = Math.round(vv.height);

  // Force body to match visual viewport — key fix
  document.body.style.height = h + 'px';

  // Clamp scroll to prevent empty space below content
  const maxScroll = Math.max(0, document.body.scrollHeight - h);
  if (document.body.scrollTop > maxScroll) {
    document.body.scrollTop = maxScroll;
  }

  // Keep input visible
  if (lockedInput) {
    const rect = lockedInput.getBoundingClientRect();
    if (rect.bottom > h - 10) {
      document.body.scrollTop += (rect.bottom - h) + 30;
    }
    // Re-clamp after scroll
    const maxS = Math.max(0, document.body.scrollHeight - h);
    if (document.body.scrollTop > maxS) {
      document.body.scrollTop = maxS;
    }
  }
}

function startLoop() {
  if (rafId) return;
  function loop() {
    sync();
    if (lockedInput) {
      rafId = requestAnimationFrame(loop);
    }
  }
  rafId = requestAnimationFrame(loop);
}

function stopLoop() {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
  // Restore natural CSS height (100dvh)
  document.body.style.height = '';
}

export function initVkKeyboardFix() {
  if (!window.visualViewport) return;

  // Focus: start sync loop
  document.addEventListener('focusin', (e: FocusEvent) => {
    const target = e.target as HTMLElement;
    if (!isTextInput(target)) return;

    lockedInput = target;
    sync(); // immediate sync
    startLoop();
  });

  // Blur: stop loop after a delay (allow focus to move to another input)
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
    }, 200);
  });

  // Also stop if chat panel opens (it manages its own scroll lock)
  window.addEventListener('closeChatPanel', stopLoop);
}
