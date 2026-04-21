/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx,html}"],
  theme: {
    extend: {
      colors: {
        'rv-window': '#1a1a1a',
        'rv-panel': '#222222',
        'rv-raised': '#2d2d2d',
        'rv-input': '#141414',
        'rv-button': '#383838',
        'rv-border-inset': '#111111',
        'rv-text': '#d4d4d4',
        'rv-text-muted': '#a0a0a0',
        'rv-text-strong': '#eaeaea',
        'rv-accent': '#0078d7',
        'rv-orange': '#e68a00',
        'rv-error': '#c14b4b',
        'rv-ok': '#4ea64e',
      },
      fontFamily: {
        'epilogue': ['Epilogue', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
