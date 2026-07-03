/**
 * TODO: Удалить весь файл после ответа поддержки VK.
 * Блокирует нативную клавиатуру — нужен только вместе с VkKeyboard.tsx.
 *
 * Sets readOnly + inputmode="none" on all inputs — this GUARANTEES
 * the native keyboard never appears (Android + iOS). The custom keyboard
 * inserts text via setRangeText + input event, which works on readOnly inputs.
 */

export function initVkInputMode() {
  function fixInput(el: HTMLElement) {
    el.setAttribute('inputmode', 'none');
    // readOnly гарантированно блокирует системную клавиатуру на Android и iOS
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      (el as HTMLInputElement).readOnly = true;
    }
  }

  // Fix existing inputs
  document.querySelectorAll('input, textarea, [contenteditable]').forEach(el => {
    fixInput(el as HTMLElement);
  });

  // Watch for new inputs added by React
  const observer = new MutationObserver(mutations => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA') {
          fixInput(node);
        }
        if (node.querySelectorAll) {
          node.querySelectorAll('input, textarea, [contenteditable]').forEach(el => {
            fixInput(el as HTMLElement);
          });
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}
