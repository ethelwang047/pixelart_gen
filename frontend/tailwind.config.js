/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#080A0F',
          900: '#0E1318',
          800: '#141B24',
          700: '#1B2330',
          600: '#28303F',
          500: '#404858',
          400: '#7A8898',
          300: '#B8C8D8',
          200: '#D8E8F0',
        },
        pixel: {
          green:       '#FF6EB4',   // hot pink — kept class name for zero component churn
          'green-dim': '#D4428A',
          amber:       '#D29922',
          'amber-bright': '#E3B341',
          red:         '#F85149',
        },
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', 'monospace'],
        mono:  ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      keyframes: {
        'fade-in': { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
      animation: {
        'fade-in': 'fade-in 0.12s ease-out',
      },
    },
  },
  plugins: [],
}
