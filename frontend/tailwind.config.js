// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter', 
          'Noto Sans JP',
          'Hiragino Sans',
          'Hiragino Kaku Gothic ProN',
          'Yu Gothic',
          'Yu Gothic UI',
          'Meiryo',
          'Takao',
          'IPAexGothic',
          'IPAPGothic',
          'VL PGothic',
          'Osaka',
          'system-ui', 
          '-apple-system', 
          'BlinkMacSystemFont', 
          'Segoe UI', 
          'Roboto', 
          'Helvetica Neue', 
          'Arial', 
          'sans-serif'
        ],
      },
      colors: {
        'primary': 'var(--color-primary)',
        'primary-hover': 'var(--color-primary-hover)',
        'background': 'var(--color-background)',
        'surface': 'var(--color-surface)',
        'surface-hover': 'var(--color-surface-hover)',
        'text': 'var(--color-text)',
        'text-secondary': 'var(--color-text-secondary)',
        'border': 'var(--color-border)',
      },
    },
  },
  plugins: [],
}
