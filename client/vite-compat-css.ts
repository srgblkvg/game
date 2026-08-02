import type { Plugin } from 'vite';

// Fixes modern rgb()/hsl() with alpha syntax for older WebKit (VK WebView)
// Converts rgb(var(--x) / 0.5) → rgba(var(--x), 0.5)
export function compatCssPlugin(): Plugin {
  return {
    name: 'compat-css',
    enforce: 'post',
    generateBundle(_, bundle) {
      for (const [filename, chunk] of Object.entries(bundle)) {
        if (chunk.type === 'asset' && filename.endsWith('.css')) {
          let css = chunk.source as string;
          let changed = false;

          // rgb(var(--x) / 0.5) with CSS var → rgba(var(--x), 0.5)
          css = css.replace(
            /rgb\(\s*(var\(--[^)]+\))\s*\/\s*([0-9.]+)\s*\)/g,
            (_, v, a) => { changed = true; return `rgba(${v}, ${a})`; }
          );

          // hsl(var(--x) / 0.5) → hsla(var(--x), 0.5)
          css = css.replace(
            /hsl\(\s*(var\(--[^)]+\))\s*\/\s*([0-9.]+)\s*\)/g,
            (_, v, a) => { changed = true; return `hsla(${v}, ${a})`; }
          );

          if (changed) {
            chunk.source = css;
          }
        }
      }
    },
  };
}
