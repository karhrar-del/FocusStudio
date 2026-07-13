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
          DEFAULT: '#E1AD01',
          light: '#F0C740'
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
