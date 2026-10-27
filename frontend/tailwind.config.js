/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: '#0B1B3A', 800: '#10244A', 700: '#16305E', 600: '#1E3A70' },
        brand: { DEFAULT: '#3D5AE8', 600: '#3049CC', 700: '#2639A8', 50: '#EEF1FD', 100: '#DDE3FB' },
        canvas: '#F3F6FC',
        ink: { DEFAULT: '#14213D', muted: '#7A879E', soft: '#4A5672' },
        line: '#E4EAF3',
        success: { DEFAULT: '#16A34A', 50: '#EAF7EF' },
        warning: { DEFAULT: '#F59E0B', 50: '#FEF5E3' },
        danger: { DEFAULT: '#EF4444', 50: '#FDECEC' },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(20,33,61,0.04), 0 1px 3px rgba(20,33,61,0.06)',
        pop: '0 10px 30px rgba(11,27,58,0.18)',
      },
    },
  },
  plugins: [],
};
