import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { cx } from '../../utils/format';

export default function ThemeToggle({ className }) {
  const { isDark, toggle, resolved } = useTheme();
  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Light theme' : 'Dark theme'}
      className={cx(
        'theme-toggle-btn group relative flex h-8 w-8 cursor-pointer items-center justify-center overflow-hidden rounded-lg border transition-all duration-200',
        'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-amber-500 hover:shadow-sm',
        'dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-white/20 dark:hover:text-amber-300 dark:hover:shadow-[0_0_16px_-6px_rgba(251,191,36,0.5)]',
        className
      )}
    >
      <span key={resolved} className="theme-toggle-icon block">
        {isDark ? <Sun size={15} /> : <Moon size={15} />}
      </span>
    </button>
  );
}
