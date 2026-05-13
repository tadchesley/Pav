import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: '#09090B',
        surface: '#18181B',
        elev: '#1F1F23',
        border: '#27272A',
        text: { primary: '#FAFAFA', secondary: '#A1A1AA', tertiary: '#71717A' },
        bull: '#22C55E',
        bear: '#EF4444',
        amber: '#F59E0B',
        indigo: '#818CF8',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.6s ease-out',
        'glow': 'glow 3s ease-in-out infinite',
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        glow: {
          '0%, 100%': { boxShadow: '0 0 40px rgba(129,140,248,0.15)' },
          '50%': { boxShadow: '0 0 80px rgba(129,140,248,0.3)' },
        },
      },
    },
  },
  plugins: [],
};
export default config;
