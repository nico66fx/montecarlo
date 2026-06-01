/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Fondo "dark fintech" idéntico a nico66fx.github.io
        base: '#0a0f1d',
        surface: '#0b1220',
        'surface-2': '#111c33',
        // Acento principal AZUL (escala brand de nico66fx)
        brand: {
          DEFAULT: '#3b82f6',
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
        // Acento secundario CIAN
        accent: {
          DEFAULT: '#22d3ee',
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
        },
        pos: '#34d399',
        neg: '#f87171',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Sora', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 24px -4px rgba(59, 130, 246, 0.45)',
        card: '0 24px 80px rgba(0, 0, 0, 0.24)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        rise: {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-dot': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.3' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.4s ease-out both',
        rise: 'rise 0.8s ease-out both',
        float: 'float 7s ease-in-out infinite',
        shimmer: 'shimmer 2.5s linear infinite',
        'pulse-dot': 'pulse-dot 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
