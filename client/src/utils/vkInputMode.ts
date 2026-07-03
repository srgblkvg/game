/**
 * TODO: Удалить весь файл после ответа поддержки VK.
 * Блокирует нативную клавиатуру в VK iframe.
 *
 * Стратегия:
 * 1. touchstart (срабатывает ДО focus) — меняем type="number"→"text"
 * 2. inputmode="none" через MutationObserver
 * 3. Браузер видит type="text" + inputmode="none" → не показывает клавиатуру
 */

export function initVkInputMode() {
  function fixInput(el: HTMLElement) {
    el.setAttribute('inputmode', 'none');
  }

  // Перехватываем касание ДО фокуса — меняем number на text
  document.addEventListener('touchstart', (e) => {
    const el = e.target as HTMLElement;
    if (el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'number') {
      (el as HTMLInputElement).type = 'text';
      el.setAttribute('inputmode', 'none');
    }
  }, { passive: true });

  // Существующие инпуты
  document.querySelectorAll('input, textarea, [contenteditable]').forEach(el => {
    fixInput(el as HTMLElement);
  });

  // Новые инпуты (React)
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
