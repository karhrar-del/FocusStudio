/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/renderer/index.html",
    "./src/renderer/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        olive: {
          dark: '#3F524C',
          light: '#566B64'
        },
        mustard: {
          DEFAULT: '#C19A5B',
          light: '#D4A373'
        },
        offwhite: '#F2F4F3',
      },
      fontFamily: {
        sans: ['Lexend', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
