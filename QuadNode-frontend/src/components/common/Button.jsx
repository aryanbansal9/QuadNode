import { cx } from '../../utils/format';

export default function Button({ variant = 'primary', size = 'md', className, ...props }) {
  const variants = {
    primary:
      'bg-blue-600 text-white font-semibold shadow-[0_2px_12px_-4px_rgba(37,99,235,0.6)] hover:bg-blue-500 active:scale-[0.98] ' +
      'dark:bg-cyan-400 dark:text-slate-950 dark:shadow-[0_2px_16px_-4px_rgba(34,211,238,0.55)] dark:hover:bg-cyan-300',
    secondary:
      'border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50 active:scale-[0.98] ' +
      'dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-white/20 dark:hover:bg-white/10',
    ghost:
      'text-slate-500 hover:text-slate-900 hover:bg-slate-100 ' +
      'dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-white/5',
    danger:
      'border border-red-500/30 bg-red-500/10 text-red-600 hover:bg-red-500/20 active:scale-[0.98] ' +
      'dark:text-red-300',
    warn:
      'border border-amber-500/30 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 active:scale-[0.98] ' +
      'dark:text-amber-300',
  };
  const sizes = {
    sm: 'px-2.5 py-1.5 text-xs',
    md: 'px-3.5 py-2 text-sm',
    lg: 'px-4 py-2.5 text-sm',
  };
  return (
    <button
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none cursor-pointer font-medium',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
}
