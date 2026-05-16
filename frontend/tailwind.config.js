/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        primary: { DEFAULT: '#2563EB', light: '#EFF6FF', dark: '#1D4ED8' },
        surface: '#FFFFFF',
        bg: '#F8FAFC',
        border: '#E2E8F0',
        muted: '#F1F5F9',
        text: '#0F172A',
        subtle: '#64748B',
      },
    },
  },
  plugins: [],
}
