import { X } from 'lucide-react';

export function Modal({ open, onClose, title, children, wide = false }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px] dark:bg-black/70" onClick={onClose} />
      <div className={`card-enter relative w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} qn-card overflow-hidden !rounded-xl shadow-2xl`}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 dark:border-white/10">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="cursor-pointer rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-200">
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px] dark:bg-black/70" onClick={onClose} />
      <aside className="absolute top-0 right-0 flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0D1117]">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 dark:border-white/10">
          <h2 className="font-mono text-xs font-semibold tracking-widest text-slate-600 uppercase dark:text-slate-300">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="cursor-pointer rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-200">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </aside>
    </div>
  );
}
