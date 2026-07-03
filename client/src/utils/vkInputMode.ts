/**
 * TODO: Удалить весь файл после ответа поддержки VK.
 * Блокирует системную клавиатуру в VK iframe.
 *
 * Подход: временный readOnly во время touchstart→touchend.
 * Это единственный надёжный способ блокировать системную клавиатуру
 * без побочных эффектов (смена типа ломает setSelectionRange/курсор).
 *
 * После touchend: readOnly=false, inputmode="none".
 * Курсор работает нормально, кастомная клавиатура вставляет символы.
 */

export function initVkInputMode() {
  let pendingFix: HTMLInputElement | null = null;

  // touchstart: временный readOnly — системная клавиатура не появится
  document.addEventListener('touchstart', (e) => {
    const el = e.target as HTMLElement;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      (el as HTMLInputElement).readOnly = true;
      pendingFix = el as HTMLInputElement;
    }
  }, { passive: true });

  // touchend: убираем readOnly, клавиатура уже не появится
  document.addEventListener('touchend', () => {
    if (pendingFix) {
      const el = pendingFix;
      pendingFix = null;
      el.readOnly = false;
      el.setAttribute('inputmode', 'none');
      setTimeout(() => el.focus(), 0);
    }
  }, { passive: true });

  // Существующие инпуты: только inputmode
  document.querySelectorAll('input, textarea').forEach(el => {
    el.setAttribute('inputmode', 'none');
  });

  // Новые инпуты (React): только inputmode
  const observer = new MutationObserver(mutations => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA') {
          node.setAttribute('inputmode', 'none');
        }
        if (node.querySelectorAll) {
          node.querySelectorAll('input, textarea').forEach(el => {
            (el as HTMLElement).setAttribute('inputmode', 'none');
          });
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}
