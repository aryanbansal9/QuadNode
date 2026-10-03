import { useConnection, CONNECTION } from '../../context/ConnectionContext';
import { cx } from '../../utils/format';

export default function ConnectionIndicator({ showLabel = true, size = 'md' }) {
  const { status } = useConnection();
  const cfg = {
    [CONNECTION.ONLINE]: { dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-300', label: 'ONLINE' },
    [CONNECTION.OFFLINE]: { dot: 'bg-red-500', text: 'text-red-600 dark:text-red-300', label: 'OFFLINE' },
    [CONNECTION.SYNCING]: { dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-300', label: 'SYNCING' },
  }[status];
  const dotSize = size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2';
  return (
    <span className="inline-flex items-center gap-2">
      <span className={cx('status-dot-live inline-block rounded-full', cfg.dot, dotSize)} />
      {showLabel && (
        <span className={cx('font-mono text-xs font-semibold tracking-widest', cfg.text)}>{cfg.label}</span>
      )}
    </span>
  );
}
