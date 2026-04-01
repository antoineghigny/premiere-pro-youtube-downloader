/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx,html}"],
  theme: {
    extend: {
      colors: {
        'grey': '#A7A3C2',
        'grey-light': '#D5CEEA',
        'grey-lighter': '#F8F5FF',
        'black': '#2A2C40',
        'main': '#6116FF',
        'btnColor': '#6116FF',
        'btnBorder': '#24008C',
      },
      fontFamily: {
        'epilogue': ['Epilogue', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
