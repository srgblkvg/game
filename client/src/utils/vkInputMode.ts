/**
 * TODO: Удалить весь файл после ответа поддержки VK.
 * Ставит inputmode="none" на все инпуты в VK iframe.
 *
 * Сами компоненты (AuctionPage и др.) рендерят type="text" вместо type="number"
 * когда обнаружен vk-iframe класс — это гарантирует что inputmode="none"
 * работает (Android игнорирует его на number-инпутах).
 */

export function initVkInputMode() {
  function fixInput(el: HTMLElement) {
    el.setAttribute('inputmode', 'none');
    // readonly блокирует нативную клавиатуру на iOS (inputmode=\"none\" не всегда работает)
    // на Android тоже не вредит
    if (el.tagName === 'INPUT') (el as HTMLInputElement).readOnly = true;
    // textarea оставляем без readonly — Enter должен добавлять перенос строки
  }

  document.querySelectorAll('input, textarea').forEach(el => fixInput(el as HTMLElement));

  const observer = new MutationObserver(mutations => {
    for (const m of mutations) {
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

  observer.observe(document.body, { childList: true, subtree: true });
}
