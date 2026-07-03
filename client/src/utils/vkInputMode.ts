/**
 * TODO: Удалить весь файл после ответа поддержки VK.
 * Блокирует нативную клавиатуру в VK iframe через inputmode="none".
 * Активируется только при наличии vk_user_id в URL (VK iframe).
 */

export function initVkInputMode() {
  const isVkIframe = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).has('vk_user_id');

  if (!isVkIframe) return;

  function fixInput(el: HTMLElement) {
    el.setAttribute('inputmode', 'none');
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
