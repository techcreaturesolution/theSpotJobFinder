/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#f8f9ff',
          surface: '#ffffff',
          dark: '#0b1c30',
          primary: '#3730a3',
          secondary: '#2563eb',
          accent: '#39b8fd',
          border: '#e0e7ff',
          muted: '#eef2ff',
        },
        primary: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#3730a3',
          700: '#2e288a',
          800: '#1e1b4b',
          900: '#0b1c30',
        },
      },
    },
  },
  plugins: [],
};
