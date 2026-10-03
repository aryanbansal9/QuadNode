import { cx } from '../../utils/format';

const tones = {
  emerald: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  red: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300',
  amber: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  orange: 'border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300',
  cyan: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
  blue: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  slate: 'border-slate-300/80 bg-slate-500/10 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300',
  violet: 'border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300',
};

export default function Badge({ tone = 'slate', children, className, mono = true, dot = false }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase transition-colors duration-200',
        mono && 'font-mono',
        tones[tone] || tones.slate,
        className
      )}
    >
      {dot && <span className="status-dot-live inline-block h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function SyncBadge({ status }) {
  const s = (status || '').toUpperCase();
  const map = {
    SYNCED: 'emerald',
    INDEXED: 'emerald',
    ACTIVE: 'emerald',
    ONLINE: 'emerald',
    PENDING: 'amber',
    SYNCING: 'amber',
    PROCESSING: 'amber',
    FAILED: 'red',
    OFFLINE: 'red',
    CONFLICT: 'orange',
    'LOCAL ONLY': 'slate',
    'SYNC ALLOWED': 'cyan',
  };
  const live = s === 'SYNCING' || s === 'PENDING' || s === 'ONLINE' || s === 'SYNCED';
  return <Badge tone={map[s] || 'slate'} dot={live}>{status}</Badge>;
}
