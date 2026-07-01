/**
 * VK WebView keyboard fix.
 *
 * Root cause: VK WebView pushes the entire iframe UP when mobile keyboard opens.
 * CSS/JS inside can't prevent this — the shift is at the OS level.
 *
 * Solution: detect how much the viewport shifted (visualViewport.offsetTop change),
 * then apply a counter-transform (translateY) to push content back down,
 * visually negating the OS-level shift.
 */

let lockedInput: HTMLElement | null = null;
let baseOffsetTop = 0;

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

function applyCompensation() {
  if (!window.visualViewport) return;

  const vv = window.visualViewport;
  const offsetDelta = baseOffsetTop - vv.offsetTop;

  if (offsetDelta > 10) {
    // OS pushed viewport up by offsetDelta pixels
    // Push content back down with transform
    const root = document.getElementById('root');
    if (root) {
      root.style.transform = `translateY(${offsetDelta}px)`;
      // Also reduce height to prevent bottom overflow
      root.style.height = `${vv.height - offsetDelta}px`;
    }
  } else {
    // No significant shift
    const root = document.getElementById('root');
    if (root) {
      root.style.transform = '';
      root.style.height = '';
    }
  }
}

function scrollInputIntoView() {
  if (!lockedInput) return;
  const scrollEl = getScrollEl();
  const inputRect = lockedInput.getBoundingClientRect();
  const inputBottom = inputRect.bottom;
  const vvHeight = window.visualViewport
    ? window.visualViewport.height
    : window.innerHeight;

  if (inputBottom > vvHeight - 30) {
    const offset = inputBottom - vvHeight + 50;
    scrollEl.scrollTop += offset;
  }
}

export function initVkKeyboardFix() {
  if (!window.visualViewport) return;

  // Capture initial offsetTop (should be 0 on most devices)
  baseOffsetTop = window.visualViewport.offsetTop || 0;

  // Focus: track input, wait for keyboard, compensate
  document.addEventListener('focusin', (e: FocusEvent) => {
    const target = e.target as HTMLElement;
    if (!isTextInput(target)) return;
    lockedInput = target;

    // Wait for keyboard to appear and viewport to shift
    setTimeout(() => {
      applyCompensation();
      scrollInputIntoView();
    }, 400);
  });

  // Viewport resize/scroll = keyboard appearing/disappearing
  window.visualViewport.addEventListener('resize', () => {
    if (lockedInput) {
      applyCompensation();
      scrollInputIntoView();
    }
  });
  window.visualViewport.addEventListener('scroll', () => {
    if (lockedInput) {
      applyCompensation();
    }
  });

  // Blur: remove compensation
  document.addEventListener('focusout', (e: FocusEvent) => {
    const target = e.target as HTMLElement;
    if (!isTextInput(target)) return;

    setTimeout(() => {
      const active = document.activeElement as HTMLElement | null;
      if (active && isTextInput(active)) {
        lockedInput = active;
        applyCompensation();
        setTimeout(scrollInputIntoView, 100);
        return;
      }

      lockedInput = null;
      const root = document.getElementById('root');
      if (root) {
        root.style.transform = '';
        root.style.height = '';
      }
    }, 200);
  });
}
