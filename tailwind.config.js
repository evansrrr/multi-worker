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
        'cf-orange': '#f6821f',
        'cf-dark': {
          900: '#1a1a2e',
          800: '#16213e',
          700: '#1e293b',
          600: '#334155',
        },
      },
    },
  },
  plugins: [],
}
