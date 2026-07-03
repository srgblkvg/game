/**
 * TODO: Удалить весь файл после ответа поддержки VK.
 * Блокирует системную клавиатуру в VK iframe.
 *
 * Стратегия:
 * 1. touchstart — временный readOnly (блокирует клавиатуру на время касания)
 * 2. touchend — убираем readOnly, меняем type="number"→"text" + inputmode="none"
 * 3. focusin — финальная проверка
 * 4. MutationObserver + attributeFilter — ловим React перерендер
 */

export function initVkInputMode() {
  let pendingFix: HTMLInputElement | null = null;

  function fixInput(el: HTMLElement) {
    el.setAttribute('inputmode', 'none');
    if (el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'number') {
      (el as HTMLInputElement).type = 'text';
    }
  }

  // touchstart: временный readOnly чтобы клавиатура не появилась
  document.addEventListener('touchstart', (e) => {
    const el = e.target as HTMLElement;
    if (el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'number') {
      (el as HTMLInputElement).readOnly = true;
      pendingFix = el as HTMLInputElement;
    }
  }, { passive: true });

  // touchend: убираем readOnly, меняем тип
  document.addEventListener('touchend', () => {
    if (pendingFix) {
      const el = pendingFix;
      pendingFix = null;
      el.type = 'text';
      el.setAttribute('inputmode', 'none');
      el.readOnly = false;
      // Возвращаем фокус
      setTimeout(() => el.focus(), 0);
    }
  }, { passive: true });

  // Финальная проверка при фокусе
  document.addEventListener('focusin', (e) => {
    const el = e.target as HTMLElement;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      fixInput(el);
    }
  });

  // Существующие инпуты
  document.querySelectorAll('input, textarea').forEach(el => fixInput(el as HTMLElement));

  // Новые инпуты + отслеживаем смену type (React перерендер)
  const observer = new MutationObserver(mutations => {
    for (const m of mutations) {
      if (m.type === 'attributes' && m.attributeName === 'type') {
        const el = m.target as HTMLInputElement;
        if (el.type === 'number') {
          el.type = 'text';
          el.setAttribute('inputmode', 'none');
        }
      }
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
