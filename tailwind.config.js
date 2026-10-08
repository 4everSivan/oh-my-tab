/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: 'var(--color-bg)',
        foreground: 'var(--color-text)',
      },
      fontFamily: {
        modern: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', '"Segoe UI"', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', '"SF Mono"', 'Menlo', 'Consolas', 'monospace'],
        serif: ['ui-serif', 'Georgia', 'Cambria', '"Times New Roman"', 'serif'],
      },
      borderRadius: {
        squircle: '22.37%',
      },
    },
  },
  plugins: [],
}
