/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 950: '#070b16', 900: '#0b1020', 800: '#10182a', 700: '#16213a', 600: '#26344a' },
        gold: { 400: '#e8bd75', 500: '#d6a456' },
        teal: { 300: '#73d7d0' },
        mint: { 300: '#72d6ad' },
        coral: { 300: '#ef9b85' },
      },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        display: ['Manrope', '"DM Sans"', 'system-ui', 'sans-serif'],
        mono: ['"DM Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
