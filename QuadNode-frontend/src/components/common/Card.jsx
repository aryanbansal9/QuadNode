import { cx } from '../../utils/format';

export function Card({ className, hover = false, children, ...props }) {
  return (
    <section className={cx('qn-card', hover && 'qn-card-hover transition-all duration-200', className)} {...props}>
      {children}
    </section>
  );
}

export function CardHeader({ title, subtitle, right }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-200/80 px-4 py-3 dark:border-white/10">
      <div>
        <h3 className="font-mono text-[11px] font-semibold tracking-[0.14em] text-slate-500 uppercase dark:text-slate-400">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-500">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, eyebrow }) {
  return (
    <div className="page-enter mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        {eyebrow && (
          <p className="mb-1 font-mono text-[10px] font-semibold tracking-[0.2em] text-blue-600 uppercase dark:text-cyan-300/80">{eyebrow}</p>
        )}
        <h1 className="font-display text-[22px] font-semibold tracking-[-0.02em] text-slate-900 dark:text-white">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
