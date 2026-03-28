export default {
  content: [
    './ui/**/*.html',
  ],
  theme: {
    extend: {
      colors: {
        ink: '#f4f4ef',
        paper: '#090909',
        elevated: '#141414',
        line: '#2a2a2a',
        muted: '#9a9a9a',
        fog: '#1b1b1b',
        accent: '#f5f5f2',
        error: '#b2003a',
      },
      fontFamily: {
        sans: ['"Aptos"', '"Segoe UI Variable"', '"Helvetica Neue"', 'sans-serif'],
        mono: ['Consolas', 'Monaco', 'monospace'],
      },
      keyframes: {
        settle: {
          '0%': {
            opacity: '0',
            transform: 'translateY(10px)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        pulseLine: {
          '0%, 100%': {
            boxShadow: '0 0 0 0 rgba(255,255,255,0)',
          },
          '50%': {
            boxShadow: '0 0 0 1px rgba(255,255,255,0.08)',
          },
        },
      },
      animation: {
        settle: 'settle 280ms cubic-bezier(0.22, 1, 0.36, 1)',
        'pulse-line': 'pulseLine 2.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
