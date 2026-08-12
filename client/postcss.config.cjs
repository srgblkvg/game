// Rewrites modern CSS rgb()/hsl() with alpha to rgba() for older WebKit compatibility
export default {
  plugins: {
    'postcss-rgb-fix': {
      postcssPlugin: 'postcss-rgb-fix',
      Declaration(decl) {
        // rgb(var(--x) / 0.5) → rgba(var(--x), 0.5) — old syntax, WebKit-compatible
        // rgb(30 41 59 / 0.9) → rgba(30, 41, 59, 0.9)
        decl.value = decl.value.replace(
          /rgb\(\s*(.+?)\s*\/\s*([0-9.]+)\s*\)/g,
          (_, color, alpha) => {
            // If it's a CSS var, keep comma-separated: rgba(var(--x), 0.5)
            if (color.includes('var(')) {
              return `rgba(${color}, ${alpha})`;
            }
            // If it's space-separated numbers, convert to commas: rgba(30, 41, 59, 0.9)
            return `rgba(${color.replace(/\s+/g, ', ')}, ${alpha})`;
          }
        );
        // hsl(var(--x) / 0.5) → hsla(var(--x), 0.5)
        decl.value = decl.value.replace(
          /hsl\(\s*(.+?)\s*\/\s*([0-9.]+)\s*\)/g,
          (_, color, alpha) => `hsla(${color}, ${alpha})`
        );
      },
    },
  },
};
