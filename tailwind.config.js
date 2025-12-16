/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        'pandora-bg': '#121212',
        'pandora-surface': '#1A1A1A',
        'pandora-border': '#2A2A2A',
        'pandora-text': '#F5F5F5',
        'pandora-muted': '#B8B8B8',
        'pandora-neon': '#6EC8FF', // primary accent (blue)
        'pandora-pink': '#9EC5FF', // secondary soft blue
        // UI highlight gradient (soft violet/blue)
        'pandora-accent-from': '#EEF2FF',
        'pandora-accent-to': '#A5B4FC',
      },
      fontFamily: {
        sans: ['Inter', 'Pretendard', 'system-ui', 'sans-serif'],
        mono: ['SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace'],
      },
      keyframes: {
        slideDown: {
          '0%': { transform: 'translateY(-12px)', opacity: 0 },
          '100%': { transform: 'translateY(0)', opacity: 1 },
        },
      },
      animation: {
        slideDown: 'slideDown 0.2s ease-out',
      },
    },
  },
  plugins: [],
};
