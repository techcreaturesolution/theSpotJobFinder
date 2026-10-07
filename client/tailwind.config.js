/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Pinterest Palette: Cocoa Elegance (https://pin.it/uSIA19VFw)
        // #2A0800 - Deep chocolate
        // #775144 - Warm chocolate brown
        // #C09891 - Soft mocha
        // #BEA8A7 - Muted blush / greige
        // #F4DBD8 - Soft blush cream
        cocoa: {
          950: '#180400',
          900: '#2A0800',
          800: '#482017',
          700: '#5F382E',
          600: '#775144',
          500: '#9C7467',
          400: '#C09891',
          300: '#BEA8A7',
          200: '#DBCECD',
          100: '#EBDCDA',
          50: '#F4DBD8',
        },
        blue: {
          50: '#F4DBD8',
          100: '#EBDCDA',
          200: '#DBCECD',
          300: '#BEA8A7',
          400: '#C09891',
          500: '#9C7467',
          600: '#8A6053',
          700: '#775144',
          800: '#482017',
          900: '#2A0800',
          950: '#180400',
        },
        slate: {
          50: '#FAF5F4',
          100: '#F4DBD8',
          200: '#E5D3D1',
          300: '#BEA8A7',
          400: '#A68E8C',
          500: '#775144',
          600: '#5C3830',
          700: '#482017',
          800: '#34140D',
          900: '#2A0800',
          950: '#180400',
        },
        indigo: {
          100: '#EBDCDA',
          800: '#5F382E',
        },
      },
    },
  },
  plugins: [],
};
