import { useTheme } from '../../context/ThemeContext';

export default function ThemeToggle({ className = '' }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      aria-pressed={isDark}
      className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium text-slate-700 transition hover:bg-violet-50 hover:text-violet-800 dark:text-slate-200 dark:hover:bg-slate-700 ${className}`}
    >
      <span aria-hidden="true" className="text-base">{isDark ? '☀' : '☾'}</span>
      {isDark ? 'Light mode' : 'Dark mode'}
    </button>
  );
}
