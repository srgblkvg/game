/**
 * TODO: Удалить весь файл после ответа поддержки VK.
 * Блокирует нативную клавиатуру — нужен только вместе с VkKeyboard.tsx.
 *
 * Blocks native keyboard in VK WebView by setting inputmode="none" on all inputs.
 * Also converts type="number" to type="text" — iOS ignores inputmode="none" on numeric inputs.
 * Uses MutationObserver to catch dynamically added inputs (React).
 */

export function initVkInputMode() {
  function fixInput(el: HTMLElement) {
    el.setAttribute('inputmode', 'none');
    // iOS игнорирует inputmode="none" на type="number" — принудительно меняем на text
    if (el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'number') {
      (el as HTMLInputElement).type = 'text';
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
