import { cx } from '../../utils/format';

export default function ProgressBar({ value, tone = 'bg-blue-500 dark:bg-cyan-400', className }) {
  return (
    <div className={cx('h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/10', className)}>
      <div className={cx('h-full rounded-full transition-all duration-500', tone)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}
