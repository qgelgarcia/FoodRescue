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
        calamansi: {
          50: '#f4f7f2',
          100: '#e5ece1',
          200: '#cddbc6',
          300: '#a7c19d',
          400: '#8fa37d',
          500: '#5c7a67',
          600: '#466152',
          700: '#39564a',
          800: '#2b3f36',
          900: '#1b281f',
        },
      },
    },
  },
  plugins: [],
};
