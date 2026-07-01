/**
 * VK WebView keyboard fix.
 *
 * CSS: html overflow:hidden + js height, body min-height + overflow-y:auto.
 * Body stays at content height (1681px), never shrinks. Keyboard overlays bottom.
 * No empty space. JS only syncs html height, not body.
 */

function syncHtmlHeight() {
  const vv = window.visualViewport;
  if (!vv) return;
  document.documentElement.style.height = Math.round(vv.height) + 'px';
}

export function initVkKeyboardFix() {
  if (!window.visualViewport) return;

  syncHtmlHeight();
  window.visualViewport.addEventListener('resize', syncHtmlHeight);
  window.addEventListener('resize', syncHtmlHeight);
}
