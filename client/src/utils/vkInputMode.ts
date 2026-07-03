/**
 * TODO: Удалить весь файл после ответа поддержки VK.
 * Блокирует нативную клавиатуру в VK iframe через inputmode="none".
 * Также меняет type="number" на type="text" — Android игнорирует
 * inputmode="none" на числовых инпутах и показывает цифровую клавиатуру.
 */

export function initVkInputMode() {
  function fixInput(el: HTMLElement) {
    // inputmode="none" блокирует системную клавиатуру
    el.setAttribute('inputmode', 'none');
    // Android показывает цифровую клавиатуру на type="number" даже с inputmode="none"
    if (el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'number') {
      (el as HTMLInputElement).type = 'text';
    }
  }

  document.querySelectorAll('input, textarea, [contenteditable]').forEach(el => {
    fixInput(el as HTMLElement);
  });

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
