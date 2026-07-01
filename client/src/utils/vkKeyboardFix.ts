/**
 * VK WebView keyboard fix.
 *
 * Diagnosis: vv.offsetTop stays 0 (WebView not pushed).
 * But vv.height shrinks from 846→224 (keyboard appears), and so does winH.
 * Body/root follow the resize, but scrollTop stays → content shifts up,
 * leaving empty space between content bottom and keyboard top.
 *
 * Fix: on viewport resize, clamp scrollTop + adjust for focused input.
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

function fixScroll() {
  const scrollEl = getScrollEl();
  const vv = window.visualViewport;
  if (!vv) return;

  const viewH = vv.height;
  const contentH = scrollEl.scrollHeight;
  const maxScroll = Math.max(0, contentH - viewH);

  // Clamp: prevent overscroll (which would show empty space)
  if (scrollEl.scrollTop > maxScroll) {
    scrollEl.scrollTop = maxScroll;
  }

  // If input is focused, scroll it into view within clamped range
  if (lockedInput) {
    requestAnimationFrame(() => {
      lockedInput!.scrollIntoView({ block: 'nearest', behavior: 'instant' });
      // Clamp again after scrollIntoView (it might overshoot)
      if (scrollEl.scrollTop > maxScroll) {
        scrollEl.scrollTop = maxScroll;
      }
    });
  }
}

export function initVkKeyboardFix() {
  if (!window.visualViewport) return;

  const vv = window.visualViewport;
  prevHeight = vv.height;

  // Focus: track input
  document.addEventListener('focusin', (e: FocusEvent) => {
    const target = e.target as HTMLElement;
    if (!isTextInput(target)) return;
    lockedInput = target;

    // Let keyboard appear, then fix
    setTimeout(fixScroll, 350);
  });

  // Viewport resize = keyboard appeared/disappeared
  vv.addEventListener('resize', () => {
    const newH = vv.height;
    if (Math.abs(newH - prevHeight) > 30) {
      fixScroll();
    }
    prevHeight = newH;
  });

  // Blur: clear tracking
  document.addEventListener('focusout', (e: FocusEvent) => {
    const target = e.target as HTMLElement;
    if (!isTextInput(target)) return;

    setTimeout(() => {
      const active = document.activeElement as HTMLElement | null;
      if (active && isTextInput(active)) {
        lockedInput = active;
        fixScroll();
        return;
      }
      lockedInput = null;
    }, 200);
  });
}
