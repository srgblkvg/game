/**
 * TODO: Удалить весь файл после ответа поддержки VK.
 * Блокирует нативную клавиатуру — нужен только вместе с VkKeyboard.tsx.
 *
 * Blocks native keyboard in VK WebView by setting inputmode="none" on all inputs.
 * Uses MutationObserver to catch dynamically added inputs (React).
 */

export function initVkInputMode() {
  // Set inputmode on existing inputs
  document.querySelectorAll('input, textarea, [contenteditable]').forEach(el => {
    (el as HTMLElement).setAttribute('inputmode', 'none');
  });

  // Watch for new inputs added by React
  const observer = new MutationObserver(mutations => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA') {
          node.setAttribute('inputmode', 'none');
        }
        if (node.querySelectorAll) {
          node.querySelectorAll('input, textarea, [contenteditable]').forEach(el => {
            (el as HTMLElement).setAttribute('inputmode', 'none');
          });
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}
