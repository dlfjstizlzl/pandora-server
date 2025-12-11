/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        'pandora-bg': '#121212',
        'pandora-surface': '#1E1E1E',
        'pandora-border': '#333333',
        'pandora-text': '#E0E0E0',
        'pandora-muted': '#A0A0A0',
        'pandora-neon': '#39FF14',
        'pandora-pink': '#FF0055',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace'],
      },
    },
  },
  plugins: [],
};
