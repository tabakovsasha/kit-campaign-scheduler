/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Roboto', 'SF Pro Display', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        canvas: 'rgb(var(--color-canvas) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        line: 'rgb(var(--color-line) / <alpha-value>)',
        ink: 'rgb(var(--color-ink) / <alpha-value>)',
        muted: 'rgb(var(--color-muted) / <alpha-value>)',
        primary: {
          DEFAULT: 'rgb(var(--color-primary) / <alpha-value>)',
          strong: 'rgb(var(--color-primary-strong) / <alpha-value>)',
          soft: 'rgb(var(--color-primary-soft) / <alpha-value>)',
        },
        success: {
          DEFAULT: 'rgb(var(--color-success) / <alpha-value>)',
          soft: 'rgb(var(--color-success-soft) / <alpha-value>)',
        },
        danger: {
          DEFAULT: 'rgb(var(--color-danger) / <alpha-value>)',
          soft: 'rgb(var(--color-danger-soft) / <alpha-value>)',
        },
        overlay: 'rgb(var(--color-overlay) / <alpha-value>)',
      },
      borderRadius: {
        sm: '0.375rem',
        DEFAULT: '0.5rem',
        md: '0.625rem',
        lg: '0.875rem',
        xl: '1rem',
      },
      boxShadow: {
        card: '0 8px 24px rgba(15, 23, 42, 0.06)',
        modal: '0 24px 60px rgba(15, 23, 42, 0.18)',
        focus: '0 0 0 4px rgba(124, 77, 255, 0.16)',
      },
      backgroundImage: {
        'app-gradient':
          'radial-gradient(circle at top left, rgba(124, 77, 255, 0.1), transparent 28%), radial-gradient(circle at bottom right, rgba(98, 63, 224, 0.08), transparent 24%)',
      },
    },
  },
  plugins: [],
};
