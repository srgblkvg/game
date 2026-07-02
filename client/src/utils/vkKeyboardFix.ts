/**
 * VK WebView keyboard fix — prevents page push-up on Android.
 * When keyboard opens, locks body to visualViewport height.
 */

let keyboardOpen = false;
let normalBodyMinHeight = '';

function onResize() {
  const vv = window.visualViewport;
  if (!vv) return;

  const vh = vv.height;
  const wh = window.innerHeight;

  // Keyboard is open when visual viewport is significantly smaller than window
  const isKeyboardOpen = vh < wh * 0.85;

  if (isKeyboardOpen && !keyboardOpen) {
    // Keyboard just opened
    keyboardOpen = true;
    normalBodyMinHeight = document.body.style.minHeight || '';
    document.body.style.minHeight = '0px'; // override min-height
    document.body.style.height = vh + 'px';
    document.body.style.overflow = 'hidden';
    // Prevent Visual Viewport scroll (which causes the push-up)
    if (vv.offsetTop > 0) {
      window.scrollTo(0, 0);
    }
  } else if (!isKeyboardOpen && keyboardOpen) {
    // Keyboard closed
    keyboardOpen = false;
    document.body.style.height = '';
    document.body.style.overflow = '';
    document.body.style.minHeight = normalBodyMinHeight;
  } else if (isKeyboardOpen && keyboardOpen) {
    // Keyboard still open — keep height in sync
    document.body.style.height = vh + 'px';
  }
}

export function initVkKeyboardFix() {
  if (!window.visualViewport) return;

  // Use both scroll and resize events
  window.visualViewport.addEventListener('resize', onResize);
  window.visualViewport.addEventListener('scroll', onResize);

  // Initial check
  onResize();
}
