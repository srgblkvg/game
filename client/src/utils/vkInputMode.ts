/**
 * TODO: Удалить весь файл после ответа поддержки VK.
 * Полностью блокирует системную клавиатуру в VK iframe.
 *
 * Двойная защита:
 * 1. readOnly — гарантированно блокирует клавиатуру на Android/iOS
 * 2. type="number" → type="text" — Android игнорирует inputmode="none" на number
 * 3. attributeFilter на type — ловит когда React меняет тип обратно
 *
 * Кастомная клавиатура работает через setRangeText (работает на readonly).
 */

export function initVkInputMode() {
  function fixInput(el: HTMLElement) {
    // readOnly гарантированно блокирует системную клавиатуру
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      (el as HTMLInputElement).readOnly = true;
    }
    el.setAttribute('inputmode', 'none');
    // Android показывает цифровую клавиатуру на number даже с inputmode="none"
    if (el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'number') {
      (el as HTMLInputElement).type = 'text';
    }
  }

  // Существующие инпуты
  document.querySelectorAll('input, textarea').forEach(el => fixInput(el as HTMLElement));

  // Новые инпуты + отслеживаем смену type (React перерендер)
  const observer = new MutationObserver(mutations => {
    for (const m of mutations) {
      // Атрибут type изменился (React перерендерил number обратно)
      if (m.type === 'attributes' && m.attributeName === 'type') {
        const el = m.target as HTMLInputElement;
        if (el.type === 'number') {
          el.type = 'text';
        }
      }
      // Новые элементы
      for (const node of m.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA') {
          fixInput(node);
        }
        if (node.querySelectorAll) {
          node.querySelectorAll('input, textarea').forEach(el => fixInput(el as HTMLElement));
        }
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['type'],
  });
}
