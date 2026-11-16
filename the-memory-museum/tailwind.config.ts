import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ivory: '#F3EBDD',
        gold: '#C6A36B',
        beige: '#D8C9B5',
        bronze: '#4A3525',
        ink: '#17130F',
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      letterSpacing: { luxe: '0.32em' },
      keyframes: {
        fadeUp: { '0%': { opacity: '0', transform: 'translateY(14px)' }, '100%': { opacity: '1', transform: 'none' } },
        fade: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        roomTitle: {
          '0%': { opacity: '0', letterSpacing: '0.5em' },
          '18%': { opacity: '1', letterSpacing: '0.32em' },
          '80%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
      },
      animation: {
        fadeUp: 'fadeUp 1.1s cubic-bezier(.2,.7,.2,1) both',
        fade: 'fade 1.4s ease both',
        roomTitle: 'roomTitle 4.5s ease both',
      },
    },
  },
  plugins: [],
};
export default config;
