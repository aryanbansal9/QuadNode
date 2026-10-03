import { Card } from './Card';
import { cx } from '../../utils/format';

const accents = {
  blue: 'bg-blue-500 dark:bg-cyan-400',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  orange: 'bg-orange-500',
  violet: 'bg-violet-500',
  red: 'bg-red-500',
  slate: 'bg-slate-400',
};

export default function MetricCard({ label, value, sub, icon: Icon, tone, accent = 'blue', alert = false, index = 0, live = false }) {
  return (
    <Card
      hover
      className={cx(
        'card-enter relative overflow-hidden px-4 py-3.5',
        alert && 'border-amber-500/40 dark:border-amber-500/30',
        index === 1 && 'stagger-1',
        index === 2 && 'stagger-2',
        index === 3 && 'stagger-3',
        index === 4 && 'stagger-4',
        index === 0 && 'stagger-1'
      )}
    >
      <span className={cx('absolute inset-y-0 left-0 w-[3px]', accents[accent] || accents.blue)} aria-hidden />
      <div className="flex items-center justify-between pl-1.5">
        <p className="font-mono text-[11px] tracking-[0.12em] text-slate-500 uppercase dark:text-slate-400">
          {label}
          {live && <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 align-middle status-dot-live" />}
        </p>
        {Icon && <Icon size={15} className="text-slate-400 dark:text-slate-500" />}
      </div>
      <p className={cx('tnum mt-1.5 pl-1.5 font-display text-2xl leading-none font-semibold tracking-[-0.01em]', tone || 'text-slate-900 dark:text-white')}>{value}</p>
      {sub && <p className="mt-1 pl-1.5 text-[11px] text-slate-400 dark:text-slate-500">{sub}</p>}
    </Card>
  );
}
