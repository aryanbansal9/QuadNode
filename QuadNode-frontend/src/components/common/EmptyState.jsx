export default function EmptyState({ icon: Icon, title, detail, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {Icon && (
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-500">
          <Icon size={18} />
        </span>
      )}
      <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-300">{title}</p>
      {detail && <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-500">{detail}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
