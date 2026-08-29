/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'rgb(var(--color-background) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        border: 'rgb(var(--color-border) / <alpha-value>)',
        foreground: 'rgb(var(--color-foreground) / <alpha-value>)',
        muted: 'rgb(var(--color-muted) / <alpha-value>)',
        primary: 'rgb(var(--color-primary) / <alpha-value>)',
        accentGoals: 'rgb(var(--color-accent-goals) / <alpha-value>)',
        accentCalendar: 'rgb(var(--color-accent-calendar) / <alpha-value>)',
        accentTasks: 'rgb(var(--color-accent-tasks) / <alpha-value>)',
        accentMoney: 'rgb(var(--color-accent-money) / <alpha-value>)',
        accentLibrary: 'rgb(var(--color-accent-library) / <alpha-value>)',
      },
    },
  },
  plugins: [],
};
