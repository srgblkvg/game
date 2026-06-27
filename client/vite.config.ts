import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

function stripUnsupportedAtRules(css: string): string {
  css = css.replace(/@property\s+--[\w-]+\s*\{[^}]*\}/g, '');
  css = unwrapBlock(css, 'layer');
  css = unwrapBlock(css, 'supports');
  return css;
}

function unwrapBlock(css: string, atRule: string): string {
  const re = new RegExp(`@${atRule}\\s+[^{]*\\{`, 'g');
  let result = '';
  let i = 0;
  for (;;) {
    re.lastIndex = i;
    const m = re.exec(css);
    if (!m) { result += css.slice(i); break; }
    result += css.slice(i, m.index);
    const depth = { v: 1 };
    let pos = (m.index + m[0].length - 1) + 1;
    while (pos < css.length && depth.v > 0) {
      if (css[pos] === '{') depth.v++;
      else if (css[pos] === '}') depth.v--;
      if (depth.v > 0) result += css[pos];
      pos++;
    }
    result += '\n';
    i = pos;
  }
  return result;
}

function fixColorMix(css: string): string {
  return css.replace(
    /color-mix\(in\s+\w+,\s*var\((--[\w-]+)\)\s+(\d+)%,\s*transparent\)/g,
    (_, variable) => `var(${variable})`
  );
}

function addTransformFallback(css: string): string {
  return css.replace(
    /translate:var\(--tw-translate-x\)\s+var\(--tw-translate-y\)/g,
    'transform:translateX(var(--tw-translate-x)) translateY(var(--tw-translate-y))'
  );
}

function inlineCssPlugin(): Plugin {
  let cssMap: Map<string, string> = new Map();

  return {
    name: 'inline-css',
    apply: 'build',

    generateBundle(_opts, bundle) {
      for (const [name, chunk] of Object.entries(bundle)) {
        if (chunk.type === 'asset' && name.endsWith('.css')) {
          let css = chunk.source as string;
          css = stripUnsupportedAtRules(css);
          css = addTransformFallback(css);
          css = fixColorMix(css);
          cssMap.set(name, css);
          delete bundle[name];
        }
        if (chunk.type === 'chunk' && chunk.viteMetadata?.importedCss) {
          chunk.viteMetadata.importedCss = new Set();
        }
      }
    },

    transformIndexHtml: {
      order: 'post',
      handler(html: string) {
        html = html.replace(/<link rel="stylesheet"[^>]*\/?>/gi, '');
        let combinedCss = '';
        for (const [, css] of cssMap) {
          combinedCss += css + '\n';
        }
        if (combinedCss) {
          html = html.replace('</head>', `<style>\n${combinedCss}\n</style>\n</head>`);
        }
        return html;
      },
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), inlineCssPlugin()],
  css: {
    transformer: 'lightningcss',
    lightningcss: {
      targets: {
        chrome: 80 << 16,
      },
      include: 1113088, // Colors (oklch→hex, lab→rgb, p3→rgb, etc.)
      exclude: 1,        // Nesting – let Tailwind output un-nested CSS
    },
  },
  server: {
    port: 5173,
    watch: {
      usePolling: true,
      interval: 500,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:3002',
        ws: true,
      },
    },
  },
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
  },
});